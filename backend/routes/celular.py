"""Rotas do modo celular (o celular funciona como câmera, pelo navegador).

Fluxo:
  1. O computador cria uma sessão (POST /celular/sessoes) e mostra um QR code com o token.
  2. O celular abre a página, usa a própria câmera e envia quadros para /celular/{token}/quadro.
  3. O computador consulta /celular/{token}/ultimo e /celular/{token}/imagem para mostrar o
     que o celular vê e quem foi identificado.

Segurança: só a rota que RECEBE quadros é acessível pela rede, e exige o token secreto da
sessão. Ela nunca devolve dados pessoais ao celular (apenas o estado do quadro). As demais
rotas só funcionam a partir deste computador.
"""
import time

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from database.conexao import sessao_da_requisicao
from database.modelos import Aluno
from services.acesso import somente_local
from services.celular import CONECTADO_ATE_S, enderecos_da_rede_local, registro
from services.identificacao import identificar_quadro
from services.reconhecimento import obter_servico_facial
from services.ponto import registrar_reconhecimento

from .identificacoes import ler_quadro

router = APIRouter(prefix="/celular", tags=["celular"])


def _sessao_ou_404(token: str):
    sessao = registro.obter(token)
    if sessao is None:
        raise HTTPException(status_code=404, detail="Sessão não encontrada ou expirada.")
    return sessao


def _sessao_para_exibicao(token: str, sessao_db: Session):
    sessao = _sessao_ou_404(token)
    aluno = (sessao.resultado or {}).get('aluno') or {}
    if aluno.get('id') is not None:
        cadastro = sessao_db.get(Aluno, aluno['id'])
        if cadastro is None or not cadastro.ativo:
            # Um quadro que já estava em processamento pode terminar após a exclusão.
            registro.remover_aluno(aluno['id'])
            sessao.jpeg = None
            sessao.resultado = None
            sessao.ultimo_quadro_em = None
    return sessao


@router.post("/sessoes", status_code=201, dependencies=[Depends(somente_local)])
def criar_sessao():
    return {"token": registro.criar().token}


@router.delete("/sessoes/{token}", status_code=204, dependencies=[Depends(somente_local)])
def encerrar_sessao(token: str):
    registro.encerrar(token)


@router.get("/conexao", dependencies=[Depends(somente_local)])
def conexao():
    """Endereços deste computador na rede, para montar o link que o celular vai abrir."""
    return {"enderecos": enderecos_da_rede_local()}


@router.post("/{token}/quadro")
def receber_quadro(
    token: str,
    imagem: UploadFile = File(...),
    sessao_db: Session = Depends(sessao_da_requisicao),
    servico=Depends(obter_servico_facial),
):
    """Chamada pelo CELULAR. Devolve só o estado do quadro, sem nenhum dado pessoal."""
    _sessao_ou_404(token)
    conteudo = ler_quadro(imagem)
    resultado = registrar_reconhecimento(sessao_db, identificar_quadro(sessao_db, servico, conteudo))
    if not registro.atualizar(token, conteudo, resultado):
        raise HTTPException(status_code=404, detail="Sessão não encontrada ou expirada.")
    return {"status": resultado["status"]}


@router.get("/{token}/ultimo", dependencies=[Depends(somente_local)])
def ultimo_resultado(token: str, sessao_db: Session = Depends(sessao_da_requisicao)):
    sessao = _sessao_para_exibicao(token, sessao_db)
    idade = None if sessao.ultimo_quadro_em is None else time.monotonic() - sessao.ultimo_quadro_em
    conectado = idade is not None and idade <= CONECTADO_ATE_S
    return {
        "conectado": conectado,
        "quadro": sessao.numero_quadro,
        "idade_ms": None if idade is None else int(idade * 1000),
        "resultado": sessao.resultado if conectado else None,
    }


@router.get("/{token}/imagem", dependencies=[Depends(somente_local)])
def ultima_imagem(token: str, sessao_db: Session = Depends(sessao_da_requisicao)):
    sessao = _sessao_para_exibicao(token, sessao_db)
    if (sessao.jpeg is None or sessao.ultimo_quadro_em is None
            or time.monotonic() - sessao.ultimo_quadro_em > CONECTADO_ATE_S):
        raise HTTPException(status_code=404, detail="Nenhum quadro recebido ainda.")
    return Response(
        content=sessao.jpeg,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )
