from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest

from database.conexao import nova_sessao
from database.modelos import Aluno, ControlePonto, EmbeddingFacial, ImagemFacial, RegistroPonto, SessaoAdmin
from services.celular import registro
from services.ponto import registrar_reconhecimento
from test_admin import CREDENCIAIS
from test_identificacao import cadastrar, quadro


@pytest.fixture()
def cadastros(cliente):
    a = cadastrar(cliente, 'Pessoa Exclusao', '529.982.247-25', 1)
    b = cadastrar(cliente, 'Pessoa Preservada', '111.444.777-35', 2)
    return a, b


def autenticar(cliente):
    assert cliente.post('/admin/configurar', json=CREDENCIAIS).status_code == 201


def test_exclusao_exige_admin_e_recusa_origem_externa(cliente, remoto, cadastros):
    a, _ = cadastros
    caminho = f"/admin/alunos/{a['id']}"
    assert cliente.delete(caminho).status_code == 401
    assert remoto.delete(caminho).status_code == 403
    autenticar(cliente)
    assert cliente.delete(caminho, headers={'origin': 'https://externo.invalid'}).status_code == 403
    cliente.post('/admin/logout')
    assert cliente.delete(caminho).status_code == 401
    assert cliente.get(f"/alunos/{a['id']}").status_code == 200


def test_exclui_dados_associados_preserva_outros_e_permite_recadastro(cliente, cadastros):
    a, b = cadastros
    autenticar(cliente)
    for pessoa in (1, 2):
        for _ in range(2):
            quadro(cliente, f'PESSOA={pessoa}'.encode())
    resposta = cliente.delete(f"/admin/alunos/{a['id']}")
    assert resposta.status_code == 204 and resposta.content == b''
    assert cliente.get(f"/alunos/{a['id']}").status_code == 404
    assert cliente.get(f"/alunos/{a['id']}/fotos/1").status_code == 404
    assert cliente.get(f"/alunos/{b['id']}").status_code == 200
    with nova_sessao() as s:
        assert s.get(Aluno, a['id']) is None
        for modelo in (ImagemFacial, EmbeddingFacial, RegistroPonto, ControlePonto):
            assert s.query(modelo).filter_by(aluno_id=a['id']).count() == 0
        assert s.query(ImagemFacial).filter_by(aluno_id=b['id']).count() == 5
        assert s.query(EmbeddingFacial).filter_by(aluno_id=b['id']).count() == 5
        assert s.query(RegistroPonto).filter_by(aluno_id=b['id']).count() == 1
    assert quadro(cliente, b'PESSOA=1').json()['status'] == 'nao_identificado'
    pontos = cliente.get('/admin/pontos').json()
    assert pontos['total'] == 1 and pontos['registros'][0]['aluno_id'] == b['id']
    novo = cadastrar(cliente, 'Pessoa Recadastrada', '529.982.247-25', 1)
    assert novo['id'] != a['id'] and novo['matricula'] != a['matricula']


def test_cadastro_inexistente_retorna_404_sem_excluir_outros(cliente, cadastros):
    autenticar(cliente)
    assert cliente.delete('/admin/alunos/999999').status_code == 404
    assert len(cliente.get('/alunos').json()) == 2


def test_sessao_expirada_nao_exclui(cliente, cadastros):
    a, _ = cadastros
    autenticar(cliente)
    with nova_sessao() as s:
        s.query(SessaoAdmin).update({SessaoAdmin.expira_em: datetime.now(timezone.utc) - timedelta(seconds=1)})
        s.commit()
    assert cliente.delete(f"/admin/alunos/{a['id']}").status_code == 401
    assert cliente.get(f"/alunos/{a['id']}").status_code == 200


def test_cartao_e_imagem_do_celular_sao_limpos_apos_exclusao(cliente, remoto, cadastros):
    a, _ = cadastros
    autenticar(cliente)
    token = cliente.post('/celular/sessoes').json()['token']
    quadro(remoto, b'PESSOA=1', caminho=f'/celular/{token}/quadro')
    salvo = cliente.get(f'/celular/{token}/ultimo').json()['resultado']
    assert salvo['aluno']['id'] == a['id']
    assert cliente.delete(f"/admin/alunos/{a['id']}").status_code == 204
    assert cliente.get(f'/celular/{token}/ultimo').json()['resultado'] is None
    assert cliente.get(f'/celular/{token}/imagem').status_code == 404
    # Simula um quadro antigo cujo processamento terminou depois da exclusão.
    assert registro.atualizar(token, b'foto-antiga', salvo)
    ultimo = cliente.get(f'/celular/{token}/ultimo').json()
    assert ultimo['resultado'] is None and ultimo['conectado'] is False
    assert cliente.get(f'/celular/{token}/imagem').status_code == 404
    assert quadro(remoto, b'PESSOA=1', caminho=f'/celular/{token}/quadro').json()['status'] == 'nao_identificado'


def test_exclusao_e_marcacao_simultaneas_nao_deixam_dados_orfaos(cliente, cadastros):
    a, _ = cadastros
    autenticar(cliente)
    resultado = {'status': 'identificado', 'rostos': 1, 'aluno': {'id': a['id']}}
    def reconhecer():
        with nova_sessao() as s:
            return registrar_reconhecimento(s, resultado)
    with ThreadPoolExecutor(max_workers=2) as executor:
        tarefa = executor.submit(reconhecer)
        assert cliente.delete(f"/admin/alunos/{a['id']}").status_code == 204
        tarefa.result(timeout=10)
    with nova_sessao() as s:
        assert s.get(Aluno, a['id']) is None
        assert s.query(RegistroPonto).filter_by(aluno_id=a['id']).count() == 0
        assert s.get(ControlePonto, a['id']) is None
