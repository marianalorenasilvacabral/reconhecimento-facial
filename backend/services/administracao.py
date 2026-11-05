"""Senha com scrypt, sessões revogáveis e limitação de tentativas de login."""
import hashlib
import hmac
import secrets
import threading
import time
from collections import deque
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from database.modelos import Administrador, SessaoAdmin

COOKIE = 'reconhecimento_admin'
_tentativas = {}
_trava = threading.Lock()


def gerar_hash(senha: str) -> str:
    sal = secrets.token_bytes(16)
    resumo = hashlib.scrypt(senha.encode('utf-8'), salt=sal, n=16384, r=8, p=1, dklen=32)
    return f'scrypt${sal.hex()}${resumo.hex()}'


def conferir_senha(senha: str, armazenada: str) -> bool:
    try:
        algoritmo, sal, esperado = armazenada.split('$')
        if algoritmo != 'scrypt':
            return False
        resumo = hashlib.scrypt(senha.encode('utf-8'), salt=bytes.fromhex(sal), n=16384, r=8, p=1, dklen=32)
        return hmac.compare_digest(resumo.hex(), esperado)
    except (ValueError, TypeError):
        return False


HASH_FICTICIO = gerar_hash(secrets.token_urlsafe(32))


def chave_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def administrador_atual(sessao: Session, request: Request):
    token = request.cookies.get(COOKIE, '')
    if not token or len(token) > 200:
        return None
    return sessao.scalar(
        select(Administrador).join(SessaoAdmin, SessaoAdmin.administrador_id == Administrador.id)
        .where(SessaoAdmin.token_hash == chave_token(token), SessaoAdmin.expira_em > datetime.now(timezone.utc))
    )


def iniciar_sessao(sessao: Session, response: Response, request: Request, administrador: Administrador):
    agora = datetime.now(timezone.utc)
    antigo = request.cookies.get(COOKIE)
    if antigo:
        sessao.execute(delete(SessaoAdmin).where(SessaoAdmin.token_hash == chave_token(antigo)))
    sessao.execute(delete(SessaoAdmin).where(SessaoAdmin.expira_em <= agora))
    token = secrets.token_urlsafe(32)
    sessao.add(SessaoAdmin(token_hash=chave_token(token), administrador_id=administrador.id, expira_em=agora + timedelta(hours=8)))
    sessao.commit()
    response.set_cookie(COOKIE, token, max_age=8 * 3600, httponly=True, samesite='strict', secure=request.url.scheme == 'https', path='/admin')
    return {'configurado': True, 'autenticado': True, 'usuario': administrador.usuario}


def limitar_login(request: Request):
    chave = request.client.host if request.client else 'local'
    with _trava:
        agora = time.monotonic()
        tentativas = _tentativas.setdefault(chave, deque())
        while tentativas and tentativas[0] <= agora - 15 * 60:
            tentativas.popleft()
        if len(tentativas) >= 5:
            raise HTTPException(429, 'Muitas tentativas. Aguarde 15 minutos para tentar novamente.')
        tentativas.append(agora)


def limpar_tentativas(request: Request | None = None):
    with _trava:
        if request is None:
            _tentativas.clear()
        else:
            _tentativas.pop(request.client.host if request.client else 'local', None)
