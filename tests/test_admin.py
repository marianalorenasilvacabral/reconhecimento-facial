from datetime import datetime, timedelta, timezone

import pytest

from database.conexao import nova_sessao
from database.modelos import Administrador, RegistroPonto, SessaoAdmin
from services.administracao import COOKIE, chave_token
from test_identificacao import cadastrar

CREDENCIAIS = {'usuario': 'administrador_teste', 'senha': 'SenhaSomenteParaTeste2026!'}


@pytest.fixture()
def autenticado(cliente):
    assert cliente.post('/admin/configurar', json=CREDENCIAIS).status_code == 201
    return cliente


def test_primeiro_acesso_cria_admin_com_hash_e_cookie_http_only(cliente):
    assert cliente.get('/admin/estado').json() == {'configurado': False, 'autenticado': False, 'usuario': None}
    resposta = cliente.post('/admin/configurar', json=CREDENCIAIS)
    assert resposta.status_code == 201
    assert resposta.json()['autenticado'] is True
    assert 'HttpOnly' in resposta.headers['set-cookie'] and 'SameSite=strict' in resposta.headers['set-cookie']
    assert CREDENCIAIS['senha'] not in resposta.text
    token = cliente.cookies.get(COOKIE)
    with nova_sessao() as s:
        assert s.get(Administrador, 1).senha_hash != CREDENCIAIS['senha']
        assert s.get(SessaoAdmin, chave_token(token)) is not None
        assert s.get(SessaoAdmin, token) is None
    assert cliente.post('/admin/configurar', json=CREDENCIAIS).status_code == 409


def test_horarios_exigem_autenticacao_e_logout_revoga_sessao(autenticado):
    cliente = autenticado
    token = cliente.cookies.get(COOKIE)
    assert cliente.get('/admin/pontos').status_code == 200
    assert cliente.post('/admin/logout').status_code == 204
    assert cliente.get('/admin/pontos').status_code == 401
    assert cliente.get('/admin/pontos', headers={'cookie': f'{COOKIE}={token}'}).status_code == 401
    assert cliente.post('/admin/login', json=CREDENCIAIS).status_code == 200


def test_senha_incorreta_e_usuario_incorreto_nao_autenticam(autenticado):
    cliente = autenticado
    cliente.post('/admin/logout')
    assert cliente.post('/admin/login', json={**CREDENCIAIS, 'senha': 'incorreta'}).status_code == 401
    assert cliente.post('/admin/login', json={**CREDENCIAIS, 'usuario': 'outro'}).status_code == 401
    assert cliente.get('/admin/pontos').status_code == 401


def test_login_tem_limite_de_tentativas(cliente):
    for _ in range(5):
        assert cliente.post('/admin/login', json=CREDENCIAIS).status_code == 401
    assert cliente.post('/admin/login', json=CREDENCIAIS).status_code == 429


@pytest.mark.parametrize('dados', [
    {'usuario': 'a', 'senha': 'SenhaValida123'},
    {'usuario': 'administrador', 'senha': 'curta'},
    {'usuario': 'administrador', 'senha': 'x' * 129},
])
def test_configuracao_recusa_credenciais_invalidas(cliente, dados):
    assert cliente.post('/admin/configurar', json=dados).status_code == 422
    with nova_sessao() as s:
        assert s.query(Administrador).count() == 0


def test_sessao_expirada_nao_acessa_horarios(autenticado):
    with nova_sessao() as s:
        s.query(SessaoAdmin).update({SessaoAdmin.expira_em: datetime.now(timezone.utc) - timedelta(seconds=1)})
        s.commit()
    assert autenticado.get('/admin/pontos').status_code == 401


def test_acesso_remoto_e_origem_externa_sao_recusados(cliente, remoto):
    assert remoto.get('/admin/estado').status_code == 403
    assert remoto.post('/admin/configurar', json=CREDENCIAIS).status_code == 403
    assert remoto.get('/admin/pontos').status_code == 403
    assert cliente.post('/admin/configurar', json=CREDENCIAIS, headers={'origin': 'https://externo.invalid'}).status_code == 403
    assert cliente.get('/admin/estado', headers={'x-forwarded-for': '192.168.0.5'}).status_code == 403


def test_filtros_fuso_duracao_total_paginacao_e_registro_aberto(autenticado):
    cliente = autenticado
    a = cadastrar(cliente, 'Pessoa Alfa', '529.982.247-25', 1)
    b = cadastrar(cliente, 'Pessoa Beta', '111.444.777-35', 2)
    # 02:30 UTC ainda é o dia anterior no Brasil.
    with nova_sessao() as s:
        s.add_all([
            RegistroPonto(aluno_id=a['id'], entrada=datetime(2026, 10, 27, 2, 30, tzinfo=timezone.utc), saida=datetime(2026, 10, 27, 5, tzinfo=timezone.utc)),
            RegistroPonto(aluno_id=b['id'], entrada=datetime(2026, 10, 27, 4, tzinfo=timezone.utc), saida=datetime(2026, 10, 27, 5, tzinfo=timezone.utc)),
        ])
        s.commit()
    resposta = cliente.get('/admin/pontos?inicio=2026-10-26&fim=2026-10-26').json()
    assert resposta['total'] == 1 and resposta['total_segundos'] == 9000
    assert resposta['registros'][0]['nome'] == 'Pessoa Alfa'
    assert 'cpf' not in resposta['registros'][0]
    assert cliente.get('/admin/pontos?nome=beta').json()['total_segundos'] == 3600
    assert cliente.get('/admin/pontos?limite=1&offset=1').json()['total'] == 2
    assert len(cliente.get('/admin/pontos?limite=1&offset=1').json()['registros']) == 1
    with nova_sessao() as s:
        s.add(RegistroPonto(aluno_id=b['id'], entrada=datetime.now(timezone.utc) - timedelta(seconds=65)))
        s.commit()
    resposta = cliente.get('/admin/pontos?nome=beta').json()
    assert resposta['abertos'] == 1 and resposta['total_segundos'] >= 3665
    assert cliente.get('/admin/pontos?inicio=2026-10-27&fim=2026-10-26').status_code == 422


def test_sem_cookie_nao_ha_leitura_de_horarios(cliente):
    assert cliente.get('/admin/pontos').status_code == 401
