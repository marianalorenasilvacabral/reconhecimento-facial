"""Configuração comum dos testes.

Os testes de banco/API rodam contra o PostgreSQL de TEST_DATABASE_URL e APAGAM os dados das
tabelas: use um banco de TESTE, nunca o banco com dados reais:
    TEST_DATABASE_URL=postgresql+psycopg://usuario:senha@localhost:5432/reconhecimento_teste pytest tests
"""
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from dotenv import load_dotenv

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "backend"))
sys.path.insert(0, str(RAIZ / "tests"))

load_dotenv(RAIZ / '.env.test')
URL_TESTE = os.getenv('TEST_DATABASE_URL', '').strip()
if URL_TESTE:
    url = make_url(URL_TESTE)
    if url.get_backend_name() != 'postgresql' or not (url.database or '').endswith(('_teste', '_test')):
        raise pytest.UsageError('TEST_DATABASE_URL precisa apontar para PostgreSQL com nome terminado em _teste ou _test.')
    os.environ['DATABASE_URL'] = URL_TESTE


def pytest_collection_modifyitems(config, items):
    if URL_TESTE:
        return
    pular = pytest.mark.skip(reason="TEST_DATABASE_URL não definida; o banco de cadastros nunca é usado nos testes")
    for item in items:
        if item.get_closest_marker('sem_banco') is None:
            item.add_marker(pular)


@pytest.fixture(autouse=True)
def banco_limpo(request):
    if request.node.get_closest_marker('sem_banco') or not URL_TESTE:
        yield
        return
    from database.conexao import obter_engine
    from database.criar_tabelas import main as criar_tabelas
    from services.celular import registro
    from services.administracao import limpar_tentativas

    criar_tabelas()
    with obter_engine().begin() as c:
        c.execute(text("TRUNCATE alunos RESTART IDENTITY CASCADE"))
        c.execute(text('TRUNCATE administradores CASCADE'))
        c.execute(text("ALTER SEQUENCE matricula_seq RESTART WITH 1"))
    registro.limpar_tudo()
    limpar_tentativas()
    yield


@pytest.fixture(autouse=True)
def reconhecedor_falso(request):
    """Troca o dlib pelo reconhecedor falso, exceto nos testes marcados com `real`."""
    if request.node.get_closest_marker('sem_banco') or not URL_TESTE:
        yield
        return
    from falso_facial import ServicoFalso
    from main import app
    from services.reconhecimento import obter_servico_facial

    if "real" not in request.keywords:
        app.dependency_overrides[obter_servico_facial] = lambda: ServicoFalso()
    yield
    app.dependency_overrides.pop(obter_servico_facial, None)


@pytest.fixture()
def cliente():
    """Cliente que parece vir DESTE computador."""
    from main import app

    return TestClient(app, client=("127.0.0.1", 50000))


@pytest.fixture()
def remoto():
    """Cliente que parece vir de OUTRO aparelho da rede (por exemplo, o celular)."""
    from main import app

    return TestClient(app, client=("192.168.0.20", 50000))
