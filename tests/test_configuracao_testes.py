"""Confirma que os comandos de teste recusam um banco de cadastros."""
import os
import subprocess
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.sem_banco
RAIZ = Path(__file__).resolve().parents[1]


def test_url_de_producao_e_recusada_antes_de_qualquer_conexao():
    ambiente = {**os.environ, 'TEST_DATABASE_URL': 'postgresql+psycopg://teste@127.0.0.1:1/cadastros'}
    resultado = subprocess.run(
        [sys.executable, '-m', 'pytest', 'tests/test_decisao.py', '--collect-only', '-q'],
        cwd=RAIZ, env=ambiente, capture_output=True, text=True, timeout=30,
    )
    assert resultado.returncode == 4
    assert 'TEST_DATABASE_URL' in resultado.stderr


def test_database_url_sozinha_nao_habilita_testes_destrutivos():
    ambiente = {**os.environ, 'TEST_DATABASE_URL': '', 'DATABASE_URL': 'postgresql+psycopg://teste@127.0.0.1:1/cadastros'}
    resultado = subprocess.run(
        [sys.executable, '-m', 'pytest', 'tests/test_api.py::test_saude', '-q'],
        cwd=RAIZ, env=ambiente, capture_output=True, text=True, timeout=30,
    )
    assert resultado.returncode == 0
    assert '1 skipped' in resultado.stdout
