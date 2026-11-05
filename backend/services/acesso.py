"""Controle de acesso simples: algumas rotas só podem ser usadas a partir deste computador.

Isto NÃO é um sistema de login. É uma proteção mínima para que, ao abrir o modo celular,
outros aparelhos da rede não consigam ler cadastros e fotos. Rotas protegidas recusam:
  - pedidos que não vêm do próprio computador (127.0.0.1 / ::1);
  - pedidos encaminhados por um proxy (cabeçalho X-Forwarded-For), como o do modo celular.
"""
from fastapi import HTTPException, Request

ORIGENS_LOCAIS = {"127.0.0.1", "::1", "localhost"}


def somente_local(request: Request) -> None:
    encaminhado = request.headers.get("x-forwarded-for") or request.headers.get("forwarded")
    origem = request.client.host if request.client else ""
    if encaminhado or origem not in ORIGENS_LOCAIS:
        raise HTTPException(status_code=403, detail="Acesso permitido apenas neste computador.")
