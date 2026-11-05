"""Reconhecedor facial FALSO, só para testes automáticos.

Em vez de analisar rostos, ele lê marcas escritas no conteúdo da "imagem":
    SEMROSTO      nenhum rosto           DOISROSTOS   dois rostos        LONGE   rosto pequeno
    PESSOA=<n>    rosto da pessoa n (padrão 0)        DESVIO=<x>   afasta o vetor em x
Pessoas diferentes ficam a distância ~0,71 uma da outra; fotos da mesma pessoa, a ~0,01.
As pessoas 10 e 11 são propositalmente parecidas (distância 0,04).
"""
import re

import numpy as np

from services.reconhecimento import ProblemaNaFoto, ResultadoQuadro


def _numero(marca: bytes, conteudo: bytes, padrao=0, tipo=int):
    achado = re.search(marca + rb"=([0-9.]+)", conteudo)
    return tipo(achado.group(1)) if achado else padrao


def vetor_falso(conteudo: bytes) -> np.ndarray:
    pessoa = _numero(rb"PESSOA", conteudo)
    v = np.zeros(128, dtype=np.float32)
    if pessoa in (10, 11):
        v[10] = 0.5
        v[11] = 0.04 * (pessoa - 10)
    else:
        v[pessoa] = 0.5
    v[99] += _numero(rb"DESVIO", conteudo, 0.0, float)
    v[120] = (sum(conteudo) % 50) / 10000  # variação mínima entre fotos diferentes
    return v


class ServicoFalso:
    def extrair_unico(self, conteudo: bytes) -> np.ndarray:
        if b"SEMROSTO" in conteudo:
            raise ProblemaNaFoto("nenhum rosto foi detectado. Use uma foto de frente, bem iluminada.")
        if b"DOISROSTOS" in conteudo:
            raise ProblemaNaFoto("há mais de um rosto na foto. Use uma foto só da pessoa.")
        if b"LONGE" in conteudo:
            raise ProblemaNaFoto("o rosto está muito pequeno. Aproxime-se da câmera.")
        return vetor_falso(conteudo)

    def processar_quadro(self, conteudo: bytes) -> ResultadoQuadro:
        if b"SEMROSTO" in conteudo:
            return ResultadoQuadro(rostos=0)
        if b"DOISROSTOS" in conteudo:
            return ResultadoQuadro(rostos=2)
        if b"LONGE" in conteudo:
            return ResultadoQuadro(rostos=1, lado=40)
        return ResultadoQuadro(rostos=1, lado=200, embedding=vetor_falso(conteudo))


class ServicoIndisponivel:
    def extrair_unico(self, conteudo):
        from services.reconhecimento import ReconhecimentoIndisponivel

        raise ReconhecimentoIndisponivel("Reconhecimento facial indisponível (teste).")

    processar_quadro = extrair_unico
