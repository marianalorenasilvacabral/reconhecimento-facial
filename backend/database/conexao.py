"""Conexão com o PostgreSQL (Etapa 3). A URL vem do .env (DATABASE_URL)."""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from configuracao import carregar_ambiente

# Procura o .env na raiz do projeto e, se existir, também em backend/.
carregar_ambiente()


def obter_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL não definida. Copie .env.example para .env e preencha a conexão."
        )
    return url


_engine = None
_Sessao = None


def obter_engine():
    global _engine, _Sessao
    if _engine is None:
        _engine = create_engine(obter_url(), pool_pre_ping=True)
        _Sessao = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def nova_sessao():
    """Cria uma sessão. Use em um bloco `with nova_sessao() as sessao:`."""
    obter_engine()
    return _Sessao()


def sessao_da_requisicao():
    """Dependência do FastAPI: uma sessão por requisição, sempre fechada no final."""
    with nova_sessao() as sessao:
        yield sessao
