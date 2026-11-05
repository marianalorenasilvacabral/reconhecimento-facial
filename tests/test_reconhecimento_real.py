"""Testes com ROSTOS DE VERDADE e o modelo facial real (dlib).

As fotos não vêm no projeto. Para rodar estes testes, crie uma pasta com quatro fotos de rosto
de frente (as duas primeiras da pessoa A, a terceira também da pessoa A, a quarta da pessoa B):
    pessoa_a1.jpg  pessoa_a2.jpg  pessoa_a3.jpg  pessoa_b1.jpg
Use apenas fotos de quem concordou em participar do teste. Depois:
    $env:PASTA_ROSTOS_TESTE="C:\\caminho\\da\\pasta"      (PowerShell)
    pytest ../tests/test_reconhecimento_real.py -s
Sem a pasta, estes testes são pulados.
"""
import io
import os
from pathlib import Path

import pytest
from PIL import Image, ImageEnhance, ImageOps

import services.reconhecimento as rec

PASTA = os.getenv("PASTA_ROSTOS_TESTE")
ARQUIVOS = ["pessoa_a1.jpg", "pessoa_a2.jpg", "pessoa_a3.jpg", "pessoa_b1.jpg"]

pytestmark = [
    pytest.mark.real,
    pytest.mark.skipif(
        not PASTA or not all((Path(PASTA) / a).exists() for a in ARQUIVOS),
        reason="defina PASTA_ROSTOS_TESTE com " + ", ".join(ARQUIVOS),
    ),
]


def carregar(nome: str) -> Image.Image:
    return ImageOps.exif_transpose(Image.open(Path(PASTA) / nome)).convert("RGB")


def jpeg(imagem: Image.Image, exif=None) -> bytes:
    saida = io.BytesIO()
    imagem.save(saida, "JPEG", quality=92, **({"exif": exif} if exif else {}))
    return saida.getvalue()


def variante(imagem: Image.Image, espelhar=False, brilho=1.0, girar=0.0) -> bytes:
    if espelhar:
        imagem = ImageOps.mirror(imagem)
    if girar:
        imagem = imagem.rotate(girar, expand=False, fillcolor=(128, 128, 128))
    return jpeg(ImageEnhance.Brightness(imagem).enhance(brilho))


def cinco_de(a: Image.Image, b: Image.Image) -> list[bytes]:
    """Cinco fotos da mesma pessoa a partir de duas originais e pequenas alterações."""
    return [jpeg(a), jpeg(b), variante(a, espelhar=True), variante(b, brilho=0.8), variante(a, girar=4)]


def cadastrar(cliente, nome, cpf, fotos):
    return cliente.post(
        "/alunos",
        data={"nome": nome, "data_nascimento": "2008-03-15", "cpf": cpf, "consentimento": "true"},
        files=[("fotos", (f"f{i}.jpg", f, "image/jpeg")) for i, f in enumerate(fotos)],
    )


def identificar(cliente, conteudo, caminho="/identificacoes"):
    return cliente.post(caminho, files={"imagem": ("q.jpg", conteudo, "image/jpeg")})


def enquadrar_como_webcam(imagem: Image.Image) -> Image.Image:
    """Recorta um quadro 4:3 em volta do rosto, como uma webcam enquadraria (rosto ~1/4 da largura).

    Uma foto de retrato inteira reduzida a 640 px deixa o rosto minúsculo; isso não é o que a
    câmera de um computador ou celular entrega a quem está diante dela.
    """
    import dlib
    import numpy as np

    pequena = imagem.copy()
    pequena.thumbnail((1000, 1000))
    fator = imagem.width / pequena.width
    achados = dlib.get_frontal_face_detector()(np.asarray(pequena), 1)
    assert len(achados) == 1, "a foto de teste precisa ter um único rosto"
    r = achados[0]
    lado = max(r.width(), r.height()) * fator
    cx, cy = (r.left() + r.right()) / 2 * fator, (r.top() + r.bottom()) / 2 * fator
    largura = lado * 4.0
    altura = largura * 3 / 4
    caixa = (cx - largura / 2, cy - altura / 2, cx + largura / 2, cy + altura / 2)
    recorte = imagem.crop(tuple(int(v) for v in caixa))  # áreas fora da foto ficam pretas
    return recorte.resize((640, 480))


@pytest.fixture()
def pessoas():
    a1, a2, a3, b1 = (carregar(n) for n in ARQUIVOS)
    return a1, a2, enquadrar_como_webcam(a3), enquadrar_como_webcam(b1)


def test_modelo_separa_a_mesma_pessoa_de_pessoas_diferentes(pessoas):
    servico = rec.ServicoFacial()
    a1, a2, a3, b1 = (servico.extrair_unico(jpeg(p)) for p in pessoas)
    import numpy as np

    mesma = [float(np.linalg.norm(x - y)) for x, y in [(a1, a2), (a1, a3), (a2, a3)]]
    diferente = [float(np.linalg.norm(x - b1)) for x in (a1, a2, a3)]
    print(f"\nmesma pessoa: {[round(d, 3) for d in mesma]}  |  pessoas diferentes: {[round(d, 3) for d in diferente]}")
    assert max(mesma) <= rec.LIMITE_DISTANCIA
    assert min(diferente) > rec.LIMITE_DISTANCIA + rec.FAIXA_INCERTA


def test_cadastro_e_identificacao_com_rostos_reais(cliente, pessoas):
    a1, a2, a3, b1 = pessoas
    assert cadastrar(cliente, "Pessoa Alfa", "529.982.247-25", cinco_de(a1, a2)).status_code == 201
    assert cadastrar(cliente, "Pessoa Beta", "111.444.777-35", cinco_de(b1, b1)).status_code == 201

    # a3 NÃO foi usada no cadastro: o sistema precisa reconhecer a pessoa em uma foto inédita
    r = identificar(cliente, jpeg(a3)).json()
    print(f"\nfoto inédita da pessoa A: {r['status']} distância={r['distancia']}")
    assert r["status"] == "identificado" and r["aluno"]["nome"] == "Pessoa Alfa"

    r = identificar(cliente, variante(b1, brilho=0.9, girar=-3)).json()
    assert r["status"] == "identificado" and r["aluno"]["nome"] == "Pessoa Beta"


def test_rosto_nao_cadastrado_nao_e_identificado(cliente, pessoas):
    a1, a2, _, b1 = pessoas
    cadastrar(cliente, "Pessoa Alfa", "529.982.247-25", cinco_de(a1, a2))
    r = identificar(cliente, jpeg(b1)).json()
    assert r["status"] == "nao_identificado" and r["aluno"] is None


def test_dois_rostos_no_quadro_pedem_revisao(cliente, pessoas):
    a1, a2, _, b1 = pessoas
    cadastrar(cliente, "Pessoa Alfa", "529.982.247-25", cinco_de(a1, a2))
    altura = 480
    esquerda = enquadrar_como_webcam(a1)  # dois rostos, ambos grandes o bastante para serem contados
    direita = b1
    lado_a_lado = Image.new("RGB", (esquerda.width + direita.width, altura), (255, 255, 255))
    lado_a_lado.paste(esquerda, (0, 0))
    lado_a_lado.paste(direita, (esquerda.width, 0))
    r = identificar(cliente, jpeg(lado_a_lado)).json()
    assert r["status"] == "revisao_necessaria" and r["aluno"] is None


def test_imagem_sem_rosto(cliente, pessoas):
    paisagem = Image.new("RGB", (640, 480), (90, 140, 200))
    assert identificar(cliente, jpeg(paisagem)).json()["status"] == "sem_rosto"


def test_foto_de_celular_girada_pelo_exif_e_lida_na_orientacao_certa(cliente, pessoas):
    a1, a2, a3, _ = pessoas
    cadastrar(cliente, "Pessoa Alfa", "529.982.247-25", cinco_de(a1, a2))
    deitada = a3.rotate(90, expand=True)  # pixels deitados, como muitos celulares gravam
    exif = Image.Exif()
    exif[0x0112] = 6  # orientação 6: "gire 90° no sentido horário para exibir"
    r = identificar(cliente, jpeg(deitada, exif=exif)).json()
    assert r["status"] == "identificado" and r["aluno"]["nome"] == "Pessoa Alfa"


def test_cadastro_recusa_foto_sem_rosto(cliente, pessoas):
    a1, a2, *_ = pessoas
    fotos = cinco_de(a1, a2)
    fotos[3] = jpeg(Image.new("RGB", (640, 480), (200, 200, 200)))
    r = cadastrar(cliente, "Pessoa Alfa", "529.982.247-25", fotos)
    assert r.status_code == 422 and "Foto 4" in r.json()["detail"] and "nenhum rosto" in r.json()["detail"]


def test_cadastro_recusa_foto_de_outra_pessoa(cliente, pessoas):
    a1, a2, _, b1 = pessoas
    fotos = cinco_de(a1, a2)
    fotos[2] = jpeg(b1)
    r = cadastrar(cliente, "Pessoa Alfa", "529.982.247-25", fotos)
    assert r.status_code == 422 and "outra pessoa" in r.json()["detail"]


def test_cadastro_recusa_foto_com_dois_rostos(cliente, pessoas):
    a1, a2, _, b1 = pessoas
    esquerda, direita = ImageOps.contain(a1, (700, 600)), ImageOps.contain(b1, (700, 600))
    dupla = Image.new("RGB", (esquerda.width + direita.width, 600), (255, 255, 255))
    dupla.paste(esquerda, (0, 0))
    dupla.paste(direita, (esquerda.width, 0))
    fotos = cinco_de(a1, a2)
    fotos[1] = jpeg(dupla)
    r = cadastrar(cliente, "Pessoa Alfa", "529.982.247-25", fotos)
    assert r.status_code == 422 and "mais de um rosto" in r.json()["detail"]


def test_fluxo_do_celular_com_rosto_real(cliente, remoto, pessoas):
    a1, a2, a3, _ = pessoas
    cadastrar(cliente, "Pessoa Alfa", "529.982.247-25", cinco_de(a1, a2))
    token = cliente.post("/celular/sessoes").json()["token"]
    r = identificar(remoto, jpeg(a3), caminho=f"/celular/{token}/quadro")
    assert r.status_code == 200 and r.json() == {"status": "identificado"}
    ultimo = cliente.get(f"/celular/{token}/ultimo").json()
    assert ultimo["resultado"]["aluno"]["nome"] == "Pessoa Alfa"
