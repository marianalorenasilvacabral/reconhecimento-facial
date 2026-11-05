"""Testes da API de alunos (cadastro, consulta, fotos e proteção de acesso).
O reconhecimento facial é substituído por um falso (tests/falso_facial.py)."""
import pytest
from falso_facial import ServicoIndisponivel

from database.conexao import nova_sessao
from database.modelos import Aluno, EmbeddingFacial, ImagemFacial
from main import app
from services.reconhecimento import MODELO, obter_servico_facial

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 200
CPF_OK = "529.982.247-25"


def cinco(conteudos=None):
    conteudos = conteudos or [JPEG, PNG, JPEG, PNG, JPEG]
    return [("fotos", (f"f{i}.jpg", c, "image/jpeg")) for i, c in enumerate(conteudos)]


def dados(**mudancas):
    base = {
        "nome": "João da Silva",
        "data_nascimento": "2008-03-15",
        "cpf": CPF_OK,
        "consentimento": "true",
    }
    base.update(mudancas)
    return base


def enviar(cliente, fotos=None, **mudancas):
    return cliente.post("/alunos", data=dados(**mudancas), files=fotos if fotos is not None else cinco())


def contar():
    with nova_sessao() as s:
        return s.query(Aluno).count(), s.query(ImagemFacial).count()


def test_saude(cliente):
    assert cliente.get("/saude").json() == {"status": "ok"}


def test_cadastro_completo(cliente):
    r = enviar(cliente)
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["matricula"].endswith("001") and corpo["nome"] == "João da Silva"
    assert contar() == (1, 5)
    with nova_sessao() as s:
        aluno = s.query(Aluno).one()
        assert aluno.cpf == "52998224725"  # guardado só com dígitos
        assert [i.tipo_mime for i in aluno.imagens] == [
            "image/jpeg", "image/png", "image/jpeg", "image/png", "image/jpeg"
        ]


def test_cadastro_grava_um_embedding_por_foto(cliente):
    enviar(cliente)
    with nova_sessao() as s:
        embeddings = s.query(EmbeddingFacial).all()
        assert len(embeddings) == 5
        assert {e.modelo for e in embeddings} == {MODELO}
        assert {e.dimensao for e in embeddings} == {128}


def test_resposta_nunca_traz_cpf_completo_nem_imagem_nas_listagens(cliente):
    enviar(cliente)
    for resposta in (cliente.get("/alunos"), cliente.get("/alunos/1")):
        texto = resposta.text
        assert "52998224725" not in texto and "529.982.247-25" not in texto
        assert "conteudo" not in texto and "vetor" not in texto
    assert cliente.get("/alunos").json()[0]["cpf"] == "***.***.***-25"


def test_cpf_duplicado_retorna_409_sem_salvar_nada_novo(cliente):
    assert enviar(cliente).status_code == 201
    r = enviar(cliente, nome="Outra Pessoa")
    assert r.status_code == 409
    assert contar() == (1, 5)
    with nova_sessao() as s:
        assert s.query(EmbeddingFacial).count() == 5


def test_mesmo_cpf_com_outra_pontuacao_tambem_e_duplicado(cliente):
    enviar(cliente)
    assert enviar(cliente, cpf="52998224725").status_code == 409


@pytest.mark.parametrize(
    "mudanca",
    [
        {"cpf": "111.111.111-11"},
        {"cpf": "529.982.247-24"},
        {"cpf": "123"},
        {"nome": "João"},
        {"nome": "   "},
        {"nome": "João123 Silva"},
        {"data_nascimento": "2999-01-01"},
        {"data_nascimento": "1800-01-01"},
        {"consentimento": "false"},
    ],
)
def test_dados_invalidos_retornam_422_e_nao_salvam(cliente, mudanca):
    r = enviar(cliente, **mudanca)
    assert r.status_code == 422
    assert contar() == (0, 0)


def test_campos_ausentes_retornam_422(cliente):
    r = cliente.post("/alunos", data={"nome": "Ana Maria"}, files=cinco())
    assert r.status_code == 422


@pytest.mark.parametrize("quantidade", [0, 4, 6])
def test_quantidade_errada_de_fotos(cliente, quantidade):
    fotos = cinco([JPEG] * quantidade) if quantidade else []
    r = enviar(cliente, fotos=fotos)
    assert r.status_code == 422
    assert contar() == (0, 0)


def test_arquivo_que_nao_e_imagem_e_recusado_mesmo_com_nome_e_tipo_de_imagem(cliente):
    r = enviar(cliente, fotos=cinco([JPEG, JPEG, b"isto e um texto qualquer", JPEG, JPEG]))
    assert r.status_code == 422
    assert "Foto 3" in r.json()["detail"]
    assert contar() == (0, 0)


def test_imagem_vazia_e_recusada(cliente):
    r = enviar(cliente, fotos=cinco([JPEG, JPEG, JPEG, JPEG, b""]))
    assert r.status_code == 422 and "Foto 5" in r.json()["detail"]


def test_imagem_maior_que_5mb_e_recusada(cliente):
    grande = b"\xff\xd8\xff" + b"0" * (5 * 1024 * 1024)
    r = enviar(cliente, fotos=cinco([grande, JPEG, JPEG, JPEG, JPEG]))
    assert r.status_code == 422 and "Foto 1" in r.json()["detail"]
    assert contar() == (0, 0)


# ------------------------------------------------------------ reconhecimento no cadastro


def test_foto_sem_rosto_e_recusada_e_nada_e_salvo(cliente):
    r = enviar(cliente, fotos=cinco([JPEG, JPEG + b"SEMROSTO", JPEG, JPEG, JPEG]))
    assert r.status_code == 422
    assert "Foto 2" in r.json()["detail"] and "nenhum rosto" in r.json()["detail"]
    assert contar() == (0, 0)


def test_foto_com_dois_rostos_e_recusada(cliente):
    r = enviar(cliente, fotos=cinco([JPEG, JPEG, JPEG, JPEG + b"DOISROSTOS", JPEG]))
    assert r.status_code == 422 and "Foto 4" in r.json()["detail"] and "mais de um rosto" in r.json()["detail"]


def test_foto_com_rosto_muito_pequeno_e_recusada(cliente):
    r = enviar(cliente, fotos=cinco([JPEG + b"LONGE", JPEG, JPEG, JPEG, JPEG]))
    assert r.status_code == 422 and "muito pequeno" in r.json()["detail"]


def test_fotos_de_pessoas_diferentes_sao_recusadas(cliente):
    r = enviar(cliente, fotos=cinco([JPEG, JPEG, JPEG + b"PESSOA=2", JPEG, JPEG]))
    assert r.status_code == 422
    assert "Foto 3" in r.json()["detail"] and "outra pessoa" in r.json()["detail"]
    assert contar() == (0, 0)


def test_sem_modelos_instalados_responde_503_e_nao_salva(cliente):
    app.dependency_overrides[obter_servico_facial] = lambda: ServicoIndisponivel()
    r = enviar(cliente)
    assert r.status_code == 503 and "indisponível" in r.json()["detail"]
    assert contar() == (0, 0)


# ------------------------------------------------------------ consulta e fotos


def test_pesquisa_por_nome(cliente):
    enviar(cliente)
    enviar(cliente, nome="Maria Souza", cpf="111.444.777-35")
    assert [a["nome"] for a in cliente.get("/alunos", params={"nome": "mar"}).json()] == ["Maria Souza"]
    assert len(cliente.get("/alunos").json()) == 2
    assert cliente.get("/alunos", params={"nome": "zzz"}).json() == []


def test_consulta_por_id(cliente):
    enviar(cliente)
    corpo = cliente.get("/alunos/1").json()
    assert corpo["nome"] == "João da Silva"
    assert corpo["total_fotos"] == 5
    assert corpo["data_nascimento"] == "2008-03-15"


def test_foto_devolve_a_imagem_certa_com_o_tipo_certo(cliente):
    enviar(cliente)  # posições: jpeg, png, jpeg, png, jpeg
    r1 = cliente.get("/alunos/1/fotos/1")
    assert r1.status_code == 200 and r1.content == JPEG
    assert r1.headers["content-type"] == "image/jpeg"
    assert r1.headers["x-content-type-options"] == "nosniff"
    r2 = cliente.get("/alunos/1/fotos/2")
    assert r2.content == PNG and r2.headers["content-type"] == "image/png"


@pytest.mark.parametrize("caminho", ["/alunos/999/fotos/1", "/alunos/1/fotos/0", "/alunos/1/fotos/6"])
def test_foto_inexistente_ou_posicao_invalida(cliente, caminho):
    enviar(cliente)
    assert cliente.get(caminho).status_code in (404, 422)


def test_foto_de_aluno_inativo_nao_e_servida(cliente):
    enviar(cliente)
    with nova_sessao() as s:
        s.query(Aluno).one().ativo = False
        s.commit()
    assert cliente.get("/alunos/1/fotos/1").status_code == 404
    assert cliente.get("/alunos/1").status_code == 404
    assert cliente.get("/alunos").json() == []


def test_aluno_inexistente_retorna_404(cliente):
    assert cliente.get("/alunos/999").status_code == 404
    assert cliente.get("/alunos/abc").status_code == 422


# ------------------------------------------------------------ proteção de acesso


@pytest.mark.parametrize(
    "metodo, caminho",
    [("get", "/alunos"), ("get", "/alunos/1"), ("get", "/alunos/1/fotos/1"), ("post", "/alunos")],
)
def test_rotas_de_dados_recusam_outros_aparelhos_da_rede(cliente, remoto, metodo, caminho):
    enviar(cliente)
    resposta = getattr(remoto, metodo)(caminho)
    assert resposta.status_code == 403
    assert "apenas neste computador" in resposta.json()["detail"]


def test_pedido_encaminhado_por_proxy_tambem_e_recusado(cliente):
    enviar(cliente)
    r = cliente.get("/alunos", headers={"X-Forwarded-For": "192.168.0.20"})
    assert r.status_code == 403
    assert cliente.get("/alunos").status_code == 200  # sem o cabeçalho, funciona
