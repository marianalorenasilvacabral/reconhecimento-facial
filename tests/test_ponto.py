from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from database.conexao import nova_sessao
from database.modelos import ControlePonto, RegistroPonto
from services import ponto
from test_identificacao import cadastrar, quadro


@pytest.fixture()
def participante(cliente):
    return cadastrar(cliente, 'Participante Ponto', '529.982.247-25', 1)


@pytest.fixture()
def relogio(monkeypatch):
    tempo = [datetime(2026, 10, 26, 12, tzinfo=timezone.utc)]
    monkeypatch.setattr(ponto, 'agora_utc', lambda: tempo[0])
    return tempo


def reconhecer(cliente):
    resposta = quadro(cliente, b'PESSOA=1')
    assert resposta.status_code == 200
    return resposta.json()['aluno']['ponto']


def test_entrada_saida_duracao_e_novo_ciclo(cliente, participante, relogio):
    assert reconhecer(cliente) is None
    entrada = reconhecer(cliente)
    assert entrada['movimento'] == 'entrada' and entrada['saida'] is None
    for _ in range(8):
        relogio[0] += timedelta(seconds=1)
        assert reconhecer(cliente)['id'] == entrada['id']
        assert reconhecer(cliente)['movimento'] == 'entrada'
    relogio[0] += timedelta(hours=2, minutes=30)
    assert reconhecer(cliente) is None
    saida = reconhecer(cliente)
    assert saida['movimento'] == 'saida' and saida['id'] == entrada['id']
    assert saida['duracao_segundos'] == 9008
    assert reconhecer(cliente)['movimento'] == 'saida'
    relogio[0] += timedelta(seconds=6)
    reconhecer(cliente)
    nova = reconhecer(cliente)
    assert nova['movimento'] == 'entrada' and nova['id'] != entrada['id']
    with nova_sessao() as s:
        assert s.query(RegistroPonto).count() == 2


def test_duvida_e_rosto_desconhecido_nao_marcam(cliente, participante, relogio):
    reconhecer(cliente)
    for marca in (b'DOISROSTOS', b'SEMROSTO', b'PESSOA=7', b'LONGE PESSOA=1'):
        quadro(cliente, marca)
    assert reconhecer(cliente) is None
    with nova_sessao() as s:
        assert s.query(RegistroPonto).count() == 0
    assert reconhecer(cliente)['movimento'] == 'entrada'


def test_controle_persistido_impede_duplicacao_entre_clientes(cliente, participante, relogio):
    reconhecer(cliente)
    entrada = reconhecer(cliente)
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app, client=('127.0.0.1', 40000)) as outro:
        assert reconhecer(outro)['id'] == entrada['id']
        assert reconhecer(outro)['movimento'] == 'entrada'


def test_requisicoes_concorrentes_registram_uma_vez(cliente, participante, relogio):
    resultado = {'status': 'identificado', 'rostos': 1, 'aluno': {'id': participante['id']}}
    def chamada(_):
        with nova_sessao() as s:
            return ponto.registrar_reconhecimento(s, resultado)
    with ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(chamada, range(8)))
    with nova_sessao() as s:
        registros = list(s.scalars(select(RegistroPonto)))
        assert len(registros) == 1 and registros[0].saida is None


def test_banco_impede_duas_entradas_abertas(cliente, participante, relogio):
    reconhecer(cliente); reconhecer(cliente)
    with nova_sessao() as s:
        s.add(RegistroPonto(aluno_id=participante['id'], entrada=relogio[0]))
        with pytest.raises(IntegrityError):
            s.commit()


def test_saida_pode_ocorrer_no_dia_seguinte(cliente, participante, relogio):
    relogio[0] = datetime(2026, 10, 27, 2, 59, tzinfo=timezone.utc)
    reconhecer(cliente); reconhecer(cliente)
    relogio[0] += timedelta(hours=2)
    reconhecer(cliente)
    assert reconhecer(cliente)['duracao_segundos'] == 7200


def test_celular_marca_mas_nao_recebe_horarios(cliente, remoto, participante, relogio):
    token = cliente.post('/celular/sessoes').json()['token']
    for _ in range(3):
        resposta = quadro(remoto, b'PESSOA=1', caminho=f'/celular/{token}/quadro')
        assert resposta.json() == {'status': 'identificado'}
    cartao = cliente.get(f'/celular/{token}/ultimo').json()['resultado']['aluno']
    assert cartao['ponto']['movimento'] == 'entrada'
