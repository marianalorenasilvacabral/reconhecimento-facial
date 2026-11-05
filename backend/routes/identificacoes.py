"""Rotas de identificação (Etapas 4 e 5).

  POST /identificacoes   recebe UM quadro (imagem) e diz quem está nele

Todas as rotas deste arquivo só funcionam a partir deste computador.
Resultados: identificado, nao_identificado, revisao_necessaria e sem_rosto.
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.conexao import sessao_da_requisicao
from services.acesso import somente_local
from services.identificacao import identificar_quadro
from services.processamento_imagem import ImagemInvalida, validar_imagem
from services.reconhecimento import obter_servico_facial
from services.ponto import registrar_reconhecimento

TAMANHO_MAX_QUADRO = 3 * 1024 * 1024

router = APIRouter(
    prefix="/identificacoes", tags=["identificacoes"], dependencies=[Depends(somente_local)]
)


class PontoCartao(BaseModel):
    id: int
    movimento: str
    entrada: str
    saida: str | None
    duracao_segundos: int
    saida_almoco: str | None = None
    retorno_almoco: str | None = None
    jornada_empresarial: bool = False


class CartaoAluno(BaseModel):
    id: int
    matricula: str
    nome: str
    data_nascimento: str
    cpf: str  # sempre mascarado
    turma: str | None
    ponto: PontoCartao | None = None


class Identificacao(BaseModel):
    status: str
    rostos: int
    motivo: str | None = None
    distancia: float | None = None  # menor = mais parecido (útil para calibrar o limite)
    aluno: CartaoAluno | None = None


def ler_quadro(imagem: UploadFile) -> bytes:
    conteudo = imagem.file.read(TAMANHO_MAX_QUADRO + 1)
    if len(conteudo) > TAMANHO_MAX_QUADRO:
        raise HTTPException(status_code=422, detail="O quadro enviado é grande demais.")
    try:
        validar_imagem(conteudo)
    except ImagemInvalida as erro:
        raise HTTPException(status_code=422, detail=f"Quadro inválido: {erro}")
    return conteudo


@router.post("", response_model=Identificacao)
def identificar(
    imagem: UploadFile = File(...),
    sessao: Session = Depends(sessao_da_requisicao),
    servico=Depends(obter_servico_facial),
):
    return registrar_reconhecimento(sessao, identificar_quadro(sessao, servico, ler_quadro(imagem)))
