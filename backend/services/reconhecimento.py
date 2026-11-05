"""Reconhecimento facial (Etapa 4): detecção, representação numérica e decisão.

Como funciona:
  1. O detector (HOG, da biblioteca dlib) localiza rostos de frente na imagem.
  2. Uma rede neural (ResNet, também do dlib) transforma o rosto em um vetor de 128 números.
  3. Dois rostos são comparados pela distância entre seus vetores: quanto MENOR a distância,
     mais parecidos. Fotos da mesma pessoa costumam ficar abaixo de ~0,45; pessoas
     diferentes, acima de ~0,7. O limite abaixo é um ponto de partida e PRECISA ser calibrado
     com fotos reais de quem vai usar o sistema (ver README).

Detectar um rosto é diferente de reconhecê-lo: o detector só diz ONDE há um rosto.

Os modelos vêm dos pacotes `dlib-bin` e `face-recognition-models` (instalados pelo pip).
Se faltarem, as funções levantam ReconhecimentoIndisponivel, e a API responde 503.
"""
from __future__ import annotations

import importlib.util
import io
import os
import threading
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from configuracao import carregar_ambiente

carregar_ambiente()

MODELO = "dlib_resnet_v1"
DIMENSAO = 128

# Ajustáveis por variáveis de ambiente (.env). Distâncias: menor = mais parecido.
LIMITE_DISTANCIA = float(os.getenv("LIMITE_DISTANCIA", "0.50"))  # até aqui: mesma pessoa
FAIXA_INCERTA = float(os.getenv("FAIXA_INCERTA", "0.07"))  # logo acima do limite: revisão
MARGEM_AMBIGUIDADE = float(os.getenv("MARGEM_AMBIGUIDADE", "0.08"))  # 2º aluno muito próximo
LIMITE_CONSISTENCIA = float(os.getenv("LIMITE_CONSISTENCIA", "0.60"))  # as 5 fotos do cadastro
LADO_MIN_ROSTO = int(os.getenv("LADO_MIN_ROSTO", "80"))  # pixels; rosto menor é "distante"

LADO_MAX_CADASTRO = 1000  # fotos do cadastro são reduzidas a este tamanho antes de analisar
LADO_MAX_QUADRO = 640  # quadros da câmera

Image.MAX_IMAGE_PIXELS = 50_000_000  # recusa imagens gigantes (proteção contra abuso)


class ReconhecimentoIndisponivel(RuntimeError):
    """dlib ou os modelos faciais não estão instalados."""


class ProblemaNaFoto(ValueError):
    """A foto não serve para o cadastro. A mensagem está pronta para ser mostrada ao usuário."""


@dataclass(frozen=True)
class Rosto:
    esquerda: int
    topo: int
    direita: int
    base: int
    pontuacao: float

    @property
    def lado(self) -> int:
        return max(self.direita - self.esquerda, self.base - self.topo)


@dataclass
class ResultadoQuadro:
    rostos: int
    lado: int = 0  # tamanho (px) do rosto, quando há exatamente um
    embedding: np.ndarray | None = None  # só preenchido com exatamente um rosto de tamanho bom


@dataclass(frozen=True)
class Decisao:
    status: str  # identificado | nao_identificado | revisao_necessaria
    aluno_id: int | None = None
    distancia: float | None = None
    motivo: str | None = None


# ---------------------------------------------------------------- decisão (sem dlib)


def distancias_por_aluno(
    vetor: np.ndarray, galeria: list[tuple[int, np.ndarray]]
) -> dict[int, float]:
    """Distância do rosto a cada aluno: média das 2 menores distâncias entre as fotos dele.

    Usar as 2 melhores (e não só a melhor) evita que UMA foto parecida com outra pessoa
    decida sozinha o resultado.
    """
    por_aluno: dict[int, list[float]] = {}
    for aluno_id, ref in galeria:
        if ref.shape != vetor.shape:
            continue
        por_aluno.setdefault(aluno_id, []).append(float(np.linalg.norm(vetor - ref)))
    return {a: float(np.mean(sorted(d)[:2])) for a, d in por_aluno.items()}


def decidir(distancias: dict[int, float]) -> Decisao:
    """Aplica as regras de decisão. Nunca devolve um aluno quando há dúvida."""
    if not distancias:
        return Decisao("nao_identificado", motivo="Nenhum aluno com rosto cadastrado.")

    ordenados = sorted(distancias.items(), key=lambda par: par[1])
    melhor_id, d1 = ordenados[0]
    d2 = ordenados[1][1] if len(ordenados) > 1 else None

    if d1 <= LIMITE_DISTANCIA:
        if d2 is not None and (d2 - d1) < MARGEM_AMBIGUIDADE:
            return Decisao(
                "revisao_necessaria", distancia=d1, motivo="Mais de um cadastro é parecido."
            )
        return Decisao("identificado", aluno_id=melhor_id, distancia=d1)
    if d1 <= LIMITE_DISTANCIA + FAIXA_INCERTA:
        return Decisao("revisao_necessaria", distancia=d1, motivo="Correspondência incerta.")
    return Decisao("nao_identificado", distancia=d1)


def verificar_consistencia(embeddings: list[np.ndarray]) -> None:
    """As fotos do cadastro devem ser da mesma pessoa. Levanta ProblemaNaFoto se alguma não for."""
    if len(embeddings) < 3:
        return
    for i, vetor in enumerate(embeddings):
        outras = [float(np.linalg.norm(vetor - o)) for j, o in enumerate(embeddings) if j != i]
        if float(np.median(outras)) > LIMITE_CONSISTENCIA:
            raise ProblemaNaFoto(
                f"Foto {i + 1}: o rosto parece ser de outra pessoa, diferente das demais fotos."
            )


# ---------------------------------------------------------------- análise de imagem (dlib)


def abrir_imagem(conteudo: bytes, lado_max: int) -> np.ndarray:
    """Abre JPG/PNG, corrige a rotação do celular (EXIF) e reduz para `lado_max`. Devolve RGB."""
    try:
        imagem = Image.open(io.BytesIO(conteudo))
        imagem.draft("RGB", (lado_max, lado_max))  # JPEG: decodifica já reduzido (mais rápido)
        imagem = ImageOps.exif_transpose(imagem).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, ValueError) as erro:
        raise ProblemaNaFoto("a imagem não pôde ser lida.") from erro
    imagem.thumbnail((lado_max, lado_max))
    return np.ascontiguousarray(np.asarray(imagem, dtype=np.uint8))


class ServicoFacial:
    """Carrega os modelos uma vez e os reutiliza. Seguro para uso por várias requisições."""

    def __init__(self) -> None:
        self._trava = threading.Lock()
        self._detector = None
        self._pontos = None
        self._codificador = None

    # -- carregamento
    def _carregar(self) -> None:
        with self._trava:
            self._carregar_modelos()

    def _carregar_modelos(self) -> None:
        if self._codificador is not None:
            return
        try:
            import dlib  # noqa: PLC0415

            # Localiza a pasta dos modelos sem importar o pacote (que depende de pkg_resources).
            spec = importlib.util.find_spec("face_recognition_models")
            if spec is None or not spec.submodule_search_locations:
                raise ImportError("face_recognition_models não instalado")
            pasta = os.path.join(list(spec.submodule_search_locations)[0], "models")
            self._detector = dlib.get_frontal_face_detector()
            self._pontos = dlib.shape_predictor(
                os.path.join(pasta, "shape_predictor_5_face_landmarks.dat")
            )
            self._codificador = dlib.face_recognition_model_v1(
                os.path.join(pasta, "dlib_face_recognition_resnet_model_v1.dat")
            )
        except (ImportError, RuntimeError, OSError) as erro:
            self._codificador = None
            raise ReconhecimentoIndisponivel(
                "Reconhecimento facial indisponível. Rode: pip install -r requirements.txt "
                f"(detalhe: {erro})"
            ) from erro

    # -- operações
    def _detectar(self, imagem: np.ndarray, ampliar: int) -> list[Rosto]:
        retangulos, pontuacoes, _ = self._detector.run(imagem, ampliar, 0.0)
        return [
            Rosto(r.left(), r.top(), r.right(), r.bottom(), float(p))
            for r, p in zip(retangulos, pontuacoes)
        ]

    def _embedding(self, imagem: np.ndarray, rosto: Rosto) -> np.ndarray:
        import dlib  # noqa: PLC0415

        caixa = dlib.rectangle(rosto.esquerda, rosto.topo, rosto.direita, rosto.base)
        pontos = self._pontos(imagem, caixa)
        vetor = self._codificador.compute_face_descriptor(imagem, pontos, 1)
        return np.asarray(vetor, dtype=np.float32)

    def extrair_unico(self, conteudo: bytes) -> np.ndarray:
        """Cadastro: a foto precisa ter exatamente um rosto, de tamanho suficiente."""
        self._carregar()
        imagem = abrir_imagem(conteudo, LADO_MAX_CADASTRO)
        with self._trava:
            rostos = self._detectar(imagem, 1)
            if not rostos:
                raise ProblemaNaFoto(
                    "nenhum rosto foi detectado. Use uma foto de frente, bem iluminada."
                )
            if len(rostos) > 1:
                raise ProblemaNaFoto("há mais de um rosto na foto. Use uma foto só da pessoa.")
            if rostos[0].lado < LADO_MIN_ROSTO:
                raise ProblemaNaFoto("o rosto está muito pequeno. Aproxime-se da câmera.")
            return self._embedding(imagem, rostos[0])

    def processar_quadro(self, conteudo: bytes) -> ResultadoQuadro:
        """Identificação: conta os rostos do quadro e, se houver um só e bom, gera o embedding."""
        self._carregar()
        try:
            imagem = abrir_imagem(conteudo, LADO_MAX_QUADRO)
        except ProblemaNaFoto:
            return ResultadoQuadro(rostos=0)
        with self._trava:
            rostos = self._detectar(imagem, 0)
            if len(rostos) != 1:
                return ResultadoQuadro(rostos=len(rostos))
            rosto = rostos[0]
            if rosto.lado < LADO_MIN_ROSTO:
                return ResultadoQuadro(rostos=1, lado=rosto.lado)
            return ResultadoQuadro(rostos=1, lado=rosto.lado, embedding=self._embedding(imagem, rosto))


_servico: ServicoFacial | None = None
_trava_global = threading.Lock()


def obter_servico_facial() -> ServicoFacial:
    """Dependência do FastAPI (os testes a substituem por um serviço falso)."""
    global _servico
    with _trava_global:
        if _servico is None:
            _servico = ServicoFacial()
        return _servico
