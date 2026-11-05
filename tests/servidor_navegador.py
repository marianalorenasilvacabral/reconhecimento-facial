"""API de testes do navegador. Usa a API real com apenas o modelo facial substituído.

Nunca executar com dados reais: exige TEST_DATABASE_URL com sufixo de teste.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import make_url

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / 'backend'))
load_dotenv(RAIZ / '.env.test')
url = os.getenv('BROWSER_TEST_DATABASE_URL', '')
if not url or not (make_url(url).database or '').endswith(('_teste', '_test')):
    raise RuntimeError('Configure BROWSER_TEST_DATABASE_URL (.env.test), separado dos testes pytest.')
if url == os.getenv('TEST_DATABASE_URL'):
    raise RuntimeError('Os testes do navegador precisam de outro banco, diferente de TEST_DATABASE_URL.')
os.environ['DATABASE_URL'] = url
os.environ['CORS_ORIGINS'] = 'http://127.0.0.1:15173'

from main import app  # noqa: E402
from database.criar_tabelas import main as criar_tabelas  # noqa: E402
from database.conexao import obter_engine  # noqa: E402
from sqlalchemy import text  # noqa: E402
from services.reconhecimento import obter_servico_facial  # noqa: E402
from falso_facial import ServicoFalso  # noqa: E402

criar_tabelas()
with obter_engine().begin() as conexao:
    conexao.execute(text('TRUNCATE alunos RESTART IDENTITY CASCADE'))
    conexao.execute(text('TRUNCATE administradores CASCADE'))
    conexao.execute(text('ALTER SEQUENCE matricula_seq RESTART WITH 1'))
app.dependency_overrides[obter_servico_facial] = lambda: ServicoFalso()

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=18000, proxy_headers=False)
