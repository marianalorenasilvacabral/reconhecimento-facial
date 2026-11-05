"""Autenticação administrativa e consulta protegida dos horários."""
import os
import re
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, SecretStr
from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from database.conexao import sessao_da_requisicao
from database.modelos import Administrador, Aluno, RegistroPonto, SessaoAdmin
from services.acesso import somente_local
from services.administracao import (
    COOKIE, HASH_FICTICIO, administrador_atual, chave_token, conferir_senha,
    gerar_hash, iniciar_sessao, limpar_tentativas, limitar_login,
)
from services.ponto import resumo_ponto
from services.celular import registro as registro_celular

FUSO = ZoneInfo('America/Sao_Paulo')


def proteger_origem(request: Request, response: Response):
    response.headers['Cache-Control'] = 'no-store'
    origem = request.headers.get('origin')
    permitidas = {o.strip() for o in os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')}
    if request.method != 'GET' and origem and origem not in permitidas:
        raise HTTPException(403, 'Origem não permitida.')


router = APIRouter(prefix='/admin', tags=['admin'], dependencies=[Depends(somente_local), Depends(proteger_origem)])


class Credenciais(BaseModel):
    usuario: str
    senha: SecretStr


def exigir_admin(request: Request, sessao: Session = Depends(sessao_da_requisicao)):
    administrador = administrador_atual(sessao, request)
    if administrador is None:
        raise HTTPException(401, 'Entre com o usuário e a senha do administrador.')
    return administrador


@router.get('/estado')
def estado(request: Request, sessao: Session = Depends(sessao_da_requisicao)):
    administrador = administrador_atual(sessao, request)
    return {
        'configurado': sessao.get(Administrador, 1) is not None,
        'autenticado': administrador is not None,
        'usuario': administrador.usuario if administrador else None,
    }


@router.post('/configurar', status_code=201)
def configurar(dados: Credenciais, request: Request, response: Response, sessao: Session = Depends(sessao_da_requisicao)):
    usuario, senha = dados.usuario.strip(), dados.senha.get_secret_value()
    if not re.fullmatch(r'[A-Za-z0-9_.-]{3,60}', usuario):
        raise HTTPException(422, 'O usuário deve ter de 3 a 60 letras, números, pontos, traços ou sublinhados.')
    if not 8 <= len(senha) <= 128:
        raise HTTPException(422, 'A senha deve ter entre 8 e 128 caracteres.')
    # Serializa a criação do primeiro e único administrador, inclusive entre processos.
    sessao.execute(text('SELECT pg_advisory_xact_lock(78392011)'))
    if sessao.get(Administrador, 1):
        raise HTTPException(409, 'O administrador já foi configurado. Use o login.')
    administrador = Administrador(id=1, usuario=usuario, senha_hash=gerar_hash(senha))
    sessao.add(administrador)
    sessao.flush()
    return iniciar_sessao(sessao, response, request, administrador)


@router.post('/login')
def login(dados: Credenciais, request: Request, response: Response, sessao: Session = Depends(sessao_da_requisicao)):
    limitar_login(request)
    administrador = sessao.get(Administrador, 1)
    senha = dados.senha.get_secret_value()
    correta = conferir_senha(senha, administrador.senha_hash if administrador else HASH_FICTICIO) if len(senha) <= 128 else False
    if not administrador or not correta or dados.usuario.strip() != administrador.usuario:
        raise HTTPException(401, 'Usuário ou senha incorretos.')
    limpar_tentativas(request)
    return iniciar_sessao(sessao, response, request, administrador)


@router.post('/logout', status_code=204)
def logout(request: Request, response: Response, sessao: Session = Depends(sessao_da_requisicao)):
    token = request.cookies.get(COOKIE)
    if token:
        sessao.execute(delete(SessaoAdmin).where(SessaoAdmin.token_hash == chave_token(token)))
        sessao.commit()
    response.delete_cookie(COOKIE, path='/admin', httponly=True, samesite='strict')


@router.get('/pontos', dependencies=[Depends(exigir_admin)])
def pontos(
    nome: str = Query('', max_length=120),
    inicio: date | None = None,
    fim: date | None = None,
    limite: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sessao: Session = Depends(sessao_da_requisicao),
):
    if inicio and fim and fim < inicio:
        raise HTTPException(422, 'A data final deve ser igual ou posterior à inicial.')
    agora = datetime.now(timezone.utc)
    condicoes = []
    if nome.strip():
        condicoes.append(Aluno.nome.ilike(f'%{nome.strip()}%'))
    if inicio:
        condicoes.append(RegistroPonto.entrada >= datetime.combine(inicio, time.min, FUSO))
    if fim:
        if fim == date.max:
            raise HTTPException(422, 'Data final fora do intervalo permitido.')
        condicoes.append(RegistroPonto.entrada < datetime.combine(fim + timedelta(days=1), time.min, FUSO))
    base = select(RegistroPonto, Aluno).join(Aluno, Aluno.id == RegistroPonto.aluno_id).where(*condicoes)
    registros = sessao.execute(base.order_by(RegistroPonto.entrada.desc(), RegistroPonto.id.desc()).offset(offset).limit(limite))
    duracao = func.greatest(0, func.extract('epoch', func.coalesce(RegistroPonto.saida, agora) - RegistroPonto.entrada))
    total, total_segundos, abertos = sessao.execute(
        select(func.count(), func.coalesce(func.sum(func.floor(duracao)), 0), func.count().filter(RegistroPonto.saida.is_(None)))
        .select_from(RegistroPonto).join(Aluno, Aluno.id == RegistroPonto.aluno_id).where(*condicoes)
    ).one()
    return {
        'registros': [{**resumo_ponto(registro, agora), 'aluno_id': aluno.id, 'nome': aluno.nome, 'matricula': aluno.matricula} for registro, aluno in registros],
        'total': total, 'total_segundos': int(total_segundos), 'abertos': abertos,
        'horario_servidor': agora.isoformat(), 'limite': limite, 'offset': offset,
    }


@router.delete('/alunos/{aluno_id}', status_code=204, dependencies=[Depends(exigir_admin)])
def excluir_aluno(aluno_id: int, sessao: Session = Depends(sessao_da_requisicao)):
    # O mesmo bloqueio é usado na marcação de ponto para serializar exclusão e reconhecimento.
    encontrado = sessao.scalar(select(Aluno.id).where(Aluno.id == aluno_id).with_for_update())
    if encontrado is None:
        raise HTTPException(404, 'Cadastro não encontrado. Atualize a lista de alunos.')
    # As chaves estrangeiras removem fotos, embeddings, pontos e controle na mesma transação.
    sessao.execute(delete(Aluno).where(Aluno.id == aluno_id))
    sessao.commit()
    registro_celular.remover_aluno(aluno_id)
