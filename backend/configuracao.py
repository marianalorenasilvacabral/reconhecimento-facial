"""Carregamento único dos arquivos locais, sem substituir variáveis do processo."""
from pathlib import Path

from dotenv import load_dotenv

RAIZ = Path(__file__).resolve().parent.parent


def carregar_ambiente():
    load_dotenv(RAIZ / '.env')
    load_dotenv(RAIZ / 'backend' / '.env')
