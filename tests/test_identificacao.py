"""Testes da identificação por quadro e do modo celular (com o reconhecedor falso)."""
import time

import pytest

from database.conexao import nova_sessao
from database.modelos import Aluno
from services.celular import registro

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200


def foto(extra: bytes = b""):
    return JPEG + extra


def cadastrar(cliente, nome, cpf, pessoa):
    marca = f"PESSOA={pessoa}".encode()
    fotos = [("fotos", (f"f{i}.jpg", foto(marca + bytes([65 + i])), "image/jpeg")) for i in range(5)]
    r = cliente.post(
        "/alunos",
        data={"nome": nome, "data_nascimento": "2008-03-15", "cpf": cpf, "consentimento": "true"},
        files=fotos,
    )
    assert r.status_code == 201, r.text
    return r.json()


def quadro(cliente, extra: bytes = b"", conteudo: bytes | None = None, caminho="/identificacoes"):
    return cliente.post(
        caminho, files={"imagem": ("quadro.jpg", conteudo if conteudo is not None else foto(extra), "image/jpeg")}
    )


@pytest.fixture()
def turma(cliente):
    joao = cadastrar(cliente, "João da Silva", "529.982.247-25", 1)
    maria = cadastrar(cliente, "Maria Souza", "111.444.777-35", 2)
    return joao, maria


# ------------------------------------------------------------------ POST /identificacoes


def test_identifica_o_aluno_certo_e_devolve_o_cartao(cliente, turma):
    r = quadro(cliente, b"PESSOA=1")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["status"] == "identificado" and corpo["rostos"] == 1
    assert corpo["aluno"]["nome"] == "João da Silva"
    assert corpo["aluno"]["matricula"] == turma[0]["matricula"]
    assert corpo["aluno"]["cpf"] == "***.***.***-25"
    assert "52998224725" not in r.text


def test_identifica_outro_aluno_sem_confundir(cliente, turma):
    assert quadro(cliente, b"PESSOA=2").json()["aluno"]["nome"] == "Maria Souza"


def test_rosto_desconhecido_nao_revela_dados_de_ninguem(cliente, turma):
    r = quadro(cliente, b"PESSOA=7")
    corpo = r.json()
    assert corpo["status"] == "nao_identificado" and corpo["aluno"] is None
    assert "João" not in r.text and "Maria" not in r.text and "2026" not in r.text


def test_sem_rosto(cliente, turma):
    corpo = quadro(cliente, b"SEMROSTO").json()
    assert corpo["status"] == "sem_rosto" and corpo["rostos"] == 0 and corpo["aluno"] is None


def test_varios_rostos_pedem_revisao_sem_mostrar_dados(cliente, turma):
    corpo = quadro(cliente, b"DOISROSTOS PESSOA=1").json()
    assert corpo["status"] == "revisao_necessaria" and corpo["aluno"] is None
    assert "mais de um rosto" in corpo["motivo"]


def test_rosto_distante_pede_revisao(cliente, turma):
    corpo = quadro(cliente, b"LONGE PESSOA=1").json()
    assert corpo["status"] == "revisao_necessaria" and corpo["aluno"] is None
    assert "Aproxime-se" in corpo["motivo"]


def test_correspondencia_incerta_pede_revisao(cliente, turma):
    corpo = quadro(cliente, b"PESSOA=1 DESVIO=0.53").json()
    assert corpo["status"] == "revisao_necessaria" and corpo["aluno"] is None


def test_desvio_grande_nao_identifica(cliente, turma):
    assert quadro(cliente, b"PESSOA=1 DESVIO=0.9").json()["status"] == "nao_identificado"


def test_dois_cadastros_parecidos_nao_sao_escolhidos_automaticamente(cliente):
    cadastrar(cliente, "Ana Clara Lima", "529.982.247-25", 10)
    cadastrar(cliente, "Ana Carla Lima", "111.444.777-35", 11)
    corpo = quadro(cliente, b"PESSOA=10").json()
    assert corpo["status"] == "revisao_necessaria" and corpo["aluno"] is None
    assert "parecido" in corpo["motivo"]


def test_sem_nenhum_cadastro(cliente):
    corpo = quadro(cliente, b"PESSOA=1").json()
    assert corpo["status"] == "nao_identificado" and corpo["aluno"] is None


def test_aluno_inativo_nao_e_identificado(cliente, turma):
    with nova_sessao() as s:
        s.query(Aluno).filter_by(nome="João da Silva").one().ativo = False
        s.commit()
    assert quadro(cliente, b"PESSOA=1").json()["status"] == "nao_identificado"


def test_quadro_que_nao_e_imagem_e_recusado(cliente, turma):
    assert quadro(cliente, conteudo=b"isto nao e uma imagem").status_code == 422


def test_quadro_muito_grande_e_recusado(cliente, turma):
    assert quadro(cliente, conteudo=JPEG + b"0" * (3 * 1024 * 1024)).status_code == 422


def test_identificacao_so_funciona_neste_computador(remoto, cliente, turma):
    assert quadro(remoto, b"PESSOA=1").status_code == 403


def test_identificacao_nao_cria_novos_alunos(cliente, turma):
    with nova_sessao() as s:
        antes = s.query(Aluno).count()
    for _ in range(3):
        quadro(cliente, b"PESSOA=1")
    with nova_sessao() as s:
        assert s.query(Aluno).count() == antes


# ------------------------------------------------------------------ modo celular


def criar_sessao(cliente) -> str:
    r = cliente.post("/celular/sessoes")
    assert r.status_code == 201
    return r.json()["token"]


def test_fluxo_do_celular_ate_o_computador(cliente, remoto, turma):
    token = criar_sessao(cliente)
    antes = cliente.get(f"/celular/{token}/ultimo").json()
    assert antes["conectado"] is False and antes["resultado"] is None
    assert cliente.get(f"/celular/{token}/imagem").status_code == 404

    enviado = foto(b"PESSOA=1")
    r = quadro(remoto, conteudo=enviado, caminho=f"/celular/{token}/quadro")
    assert r.status_code == 200
    assert r.json() == {"status": "identificado"}  # o celular só recebe o estado
    assert "João" not in r.text and "aluno" not in r.text

    ultimo = cliente.get(f"/celular/{token}/ultimo").json()
    assert ultimo["conectado"] is True and ultimo["quadro"] == 1
    assert ultimo["resultado"]["status"] == "identificado"
    assert ultimo["resultado"]["aluno"]["nome"] == "João da Silva"

    imagem = cliente.get(f"/celular/{token}/imagem")
    assert imagem.status_code == 200 and imagem.content == enviado
    assert imagem.headers["cache-control"] == "no-store"


def test_celular_nao_alcanca_nada_alem_do_envio_de_quadros(cliente, remoto, turma):
    token = criar_sessao(cliente)
    assert remoto.post("/celular/sessoes").status_code == 403
    assert remoto.get(f"/celular/{token}/ultimo").status_code == 403
    assert remoto.get(f"/celular/{token}/imagem").status_code == 403
    assert remoto.get("/celular/conexao").status_code == 403
    assert remoto.delete(f"/celular/sessoes/{token}").status_code == 403
    assert remoto.get("/alunos").status_code == 403
    assert remoto.post("/identificacoes", files={"imagem": ("q.jpg", JPEG, "image/jpeg")}).status_code == 403


def test_token_invalido_ou_encerrado_e_recusado(cliente, remoto, turma):
    assert quadro(remoto, caminho="/celular/token-falso/quadro").status_code == 404
    token = criar_sessao(cliente)
    cliente.delete(f"/celular/sessoes/{token}")
    assert quadro(remoto, caminho=f"/celular/{token}/quadro").status_code == 404
    assert cliente.get(f"/celular/{token}/ultimo").status_code == 404


def test_sessao_expira_sozinha_depois_de_ociosa(cliente, remoto, turma):
    token = criar_sessao(cliente)
    registro._sessoes[token].ultima_atividade -= 16 * 60
    assert quadro(remoto, caminho=f"/celular/{token}/quadro").status_code == 404


def test_celular_e_considerado_desconectado_sem_quadros_recentes(cliente, remoto, turma):
    token = criar_sessao(cliente)
    quadro(remoto, b"PESSOA=1", caminho=f"/celular/{token}/quadro")
    registro._sessoes[token].ultimo_quadro_em = time.monotonic() - 10
    ultimo = cliente.get(f"/celular/{token}/ultimo").json()
    assert ultimo["conectado"] is False
    assert ultimo['resultado'] is None
    assert cliente.get(f"/celular/{token}/imagem").status_code == 404


def test_quadro_em_processamento_nao_ressuscita_sessao_expirada(cliente):
    token = criar_sessao(cliente)
    registro._sessoes[token].ultima_atividade -= 16 * 60
    assert registro.atualizar(token, JPEG, {'status': 'sem_rosto'}) is False


def test_quadro_invalido_do_celular_e_recusado(cliente, remoto, turma):
    token = criar_sessao(cliente)
    r = quadro(remoto, conteudo=b"nao e imagem", caminho=f"/celular/{token}/quadro")
    assert r.status_code == 422


def test_limite_de_sessoes_simultaneas(cliente):
    tokens = [criar_sessao(cliente) for _ in range(7)]
    assert cliente.get(f"/celular/{tokens[0]}/ultimo").status_code == 404  # a mais antiga saiu
    assert cliente.get(f"/celular/{tokens[-1]}/ultimo").status_code == 200


def test_conexao_lista_enderecos_da_rede(cliente):
    r = cliente.get("/celular/conexao")
    assert r.status_code == 200 and isinstance(r.json()["enderecos"], list)
    assert all(not ip.startswith("127.") for ip in r.json()["enderecos"])
