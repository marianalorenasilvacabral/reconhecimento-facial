"""Rotas de alunos (Etapa 3).

  POST /alunos              cria o cadastro com as 5 fotos (multipart/form-data)
  GET  /alunos?nome=        pesquisa por parte do nome
  GET  /alunos/{id}         consulta um aluno
  GET  /alunos/{id}/fotos/{posicao}   devolve uma das 5 fotos (imagem)
  PUT  /alunos/{id}         ainda não implementada

Nenhuma resposta devolve o CPF completo. As fotos só saem pela rota de fotos.
Todas as rotas deste arquivo só respondem a pedidos feitos a partir deste computador
(services/acesso.py). Isto não é um login: não exponha a API na rede.
"""
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, Query, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database.conexao import sessao_da_requisicao
from database.modelos import TOTAL_FOTOS, Aluno, ImagemFacial
from database.repositorio import CpfDuplicado, buscar_por_id, buscar_por_nome, criar_aluno
from services.acesso import somente_local
from services.processamento_imagem import TAMANHO_MAX_BYTES, ImagemInvalida, validar_imagem
from services.reconhecimento import (
    MODELO,
    ProblemaNaFoto,
    obter_servico_facial,
    verificar_consistencia,
)
from services.validacao import (
    apenas_digitos,
    cpf_valido,
    erro_no_nascimento,
    erro_no_nome,
    mascarar_cpf,
)

router = APIRouter(prefix="/alunos", tags=["alunos"], dependencies=[Depends(somente_local)])


class AlunoCriado(BaseModel):
    id: int
    matricula: str
    nome: str


class AlunoResumo(BaseModel):
    id: int
    matricula: str
    nome: str
    data_nascimento: date
    cpf: str  # sempre mascarado
    turma: str | None


class AlunoDetalhe(AlunoResumo):
    total_fotos: int
    criado_em: datetime


def _resumo(aluno: Aluno) -> dict:
    return {
        "id": aluno.id,
        "matricula": aluno.matricula,
        "nome": aluno.nome,
        "data_nascimento": aluno.data_nascimento,
        "cpf": mascarar_cpf(aluno.cpf),
        "turma": aluno.turma,
    }


def _recusar(mensagem: str):
    raise HTTPException(status_code=422, detail=mensagem)


@router.post("", status_code=201, response_model=AlunoCriado)
def criar(
    nome: str = Form(...),
    data_nascimento: date = Form(...),
    cpf: str = Form(...),
    consentimento: bool = Form(...),
    fotos: list[UploadFile] = File(...),
    sessao: Session = Depends(sessao_da_requisicao),
    servico=Depends(obter_servico_facial),
):
    if not consentimento:
        _recusar("É necessário confirmar a ciência e a autorização para o cadastro.")
    if (erro := erro_no_nome(nome)) is not None:
        _recusar(erro)
    if (erro := erro_no_nascimento(data_nascimento)) is not None:
        _recusar(erro)
    if not cpf_valido(cpf):
        _recusar("CPF inválido. Confira os dígitos.")
    if len(fotos) != TOTAL_FOTOS:
        _recusar(f"São necessárias exatamente {TOTAL_FOTOS} fotos (recebidas: {len(fotos)}).")

    arquivos: list[tuple[bytes, str]] = []
    for numero, foto in enumerate(fotos, start=1):
        # Lê no máximo 1 byte além do limite, para não carregar arquivos gigantes na memória.
        conteudo = foto.file.read(TAMANHO_MAX_BYTES + 1)
        try:
            tipo = validar_imagem(conteudo)
        except ImagemInvalida as erro:
            _recusar(f"Foto {numero}: {erro}")
        arquivos.append((conteudo, tipo))

    # Reconhecimento facial: cada foto precisa ter exatamente um rosto, e as cinco fotos
    # precisam ser da mesma pessoa. Só então o cadastro é salvo.
    embeddings = []
    for numero, (conteudo, _tipo) in enumerate(arquivos, start=1):
        try:
            embeddings.append(servico.extrair_unico(conteudo))
        except ProblemaNaFoto as erro:
            _recusar(f"Foto {numero}: {erro}")
    try:
        verificar_consistencia(embeddings)
    except ProblemaNaFoto as erro:
        _recusar(str(erro))

    try:
        aluno = criar_aluno(
            sessao,
            nome=nome,
            data_nascimento=data_nascimento,
            cpf=apenas_digitos(cpf),
            fotos=arquivos,
            embeddings=embeddings,
            modelo=MODELO,
        )
    except CpfDuplicado:
        raise HTTPException(status_code=409, detail="Já existe um cadastro com este CPF.")

    return {"id": aluno.id, "matricula": aluno.matricula, "nome": aluno.nome}


@router.get("", response_model=list[AlunoResumo])
def pesquisar(
    nome: str = Query("", max_length=120),
    limite: int = Query(50, ge=1, le=200),
    sessao: Session = Depends(sessao_da_requisicao),
):
    return [_resumo(a) for a in buscar_por_nome(sessao, nome, limite)]


@router.get("/{aluno_id}", response_model=AlunoDetalhe)
def consultar(aluno_id: int, sessao: Session = Depends(sessao_da_requisicao)):
    aluno = buscar_por_id(sessao, aluno_id)
    if aluno is None or not aluno.ativo:
        raise HTTPException(status_code=404, detail="Aluno não encontrado.")
    total_fotos = sessao.scalar(
        select(func.count()).select_from(ImagemFacial).where(ImagemFacial.aluno_id == aluno.id)
    )
    return {**_resumo(aluno), "total_fotos": total_fotos, "criado_em": aluno.criado_em}


@router.get("/{aluno_id}/fotos/{posicao}")
def foto(
    aluno_id: int,
    posicao: int = Path(ge=1, le=TOTAL_FOTOS),
    sessao: Session = Depends(sessao_da_requisicao),
):
    """Devolve uma das fotos do aluno (posição 1 a 5) para exibição na tela de consulta."""
    imagem = sessao.scalar(
        select(ImagemFacial)
        .join(Aluno, Aluno.id == ImagemFacial.aluno_id)
        .where(
            ImagemFacial.aluno_id == aluno_id,
            ImagemFacial.posicao == posicao,
            Aluno.ativo.is_(True),
        )
    )
    if imagem is None:
        raise HTTPException(status_code=404, detail="Foto não encontrada.")
    return Response(
        content=imagem.conteudo,
        media_type=imagem.tipo_mime,
        headers={
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.put("/{aluno_id}")
def atualizar(aluno_id: int):
    raise HTTPException(status_code=501, detail="Rota ainda não implementada.")
