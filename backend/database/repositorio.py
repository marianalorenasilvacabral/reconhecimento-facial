"""Operações de cadastro no banco: criar aluno com as 5 fotos (e seus embeddings), consultar
e carregar a "galeria" de rostos usada na identificação.

Estas funções só falam com o banco. A validação dos arquivos recebidos e a análise facial
ficam em services/.
"""
import hashlib
from datetime import date, datetime, timezone

import numpy as np
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .modelos import TOTAL_FOTOS, Aluno, EmbeddingFacial, ImagemFacial


class CpfDuplicado(Exception):
    """Já existe um aluno com este CPF."""


def criar_aluno(
    sessao: Session,
    *,
    nome: str,
    data_nascimento: date,
    cpf: str,
    fotos: list[tuple[bytes, str]],
    turma: str | None = None,
    embeddings: list | None = None,
    modelo: str | None = None,
) -> Aluno:
    """Salva o aluno, as cinco fotos e (se informados) os embeddings na mesma transação.

    `fotos` é uma lista de (conteúdo em bytes, tipo MIME), na ordem das posições 1 a 5.
    `embeddings`, quando informado, tem um vetor por foto, na mesma ordem, e exige `modelo`.
    """
    if len(fotos) != TOTAL_FOTOS:
        raise ValueError(f"São necessárias exatamente {TOTAL_FOTOS} fotos.")
    if embeddings is not None and (len(embeddings) != len(fotos) or not modelo):
        raise ValueError("Informe um embedding por foto e o nome do modelo.")

    aluno = Aluno(
        nome=" ".join(nome.split()),
        data_nascimento=data_nascimento,
        cpf=cpf,
        turma=turma,
        consentimento_em=datetime.now(timezone.utc),
    )
    for posicao, (conteudo, tipo_mime) in enumerate(fotos, start=1):
        aluno.imagens.append(
            ImagemFacial(
                posicao=posicao,
                tipo_mime=tipo_mime,
                tamanho_bytes=len(conteudo),
                sha256=hashlib.sha256(conteudo).hexdigest(),
                conteudo=conteudo,
            )
        )

    sessao.add(aluno)
    try:
        sessao.flush()  # gera os ids; o CPF repetido é detectado aqui
        if embeddings is not None:
            for imagem, vetor in zip(aluno.imagens, embeddings):
                guardar_embedding(sessao, aluno.id, imagem.id, vetor, modelo)
        sessao.commit()
    except IntegrityError as erro:
        sessao.rollback()
        if "alunos_cpf_key" in str(erro.orig):
            raise CpfDuplicado() from erro
        raise
    return aluno


def guardar_embedding(sessao: Session, aluno_id: int, imagem_id: int, vetor, modelo: str) -> None:
    vetor32 = np.asarray(vetor, dtype=np.float32).ravel()
    sessao.add(
        EmbeddingFacial(
            aluno_id=aluno_id,
            imagem_id=imagem_id,
            modelo=modelo,
            dimensao=int(vetor32.size),
            vetor=vetor32.tobytes(),
        )
    )


def buscar_por_id(sessao: Session, aluno_id: int) -> Aluno | None:
    return sessao.get(Aluno, aluno_id)


def buscar_por_nome(sessao: Session, trecho: str, limite: int = 50) -> list[Aluno]:
    """Pesquisa por parte do nome (sem diferenciar maiúsculas). Não carrega as imagens."""
    consulta = (
        select(Aluno)
        .where(Aluno.ativo.is_(True), Aluno.nome.ilike(f"%{trecho.strip()}%"))
        .order_by(Aluno.nome)
        .limit(limite)
    )
    return list(sessao.scalars(consulta))


def carregar_galeria(sessao: Session, modelo: str) -> list[tuple[int, np.ndarray]]:
    """Todos os embeddings dos alunos ativos, gerados por `modelo`: [(aluno_id, vetor), ...]."""
    consulta = (
        select(EmbeddingFacial.aluno_id, EmbeddingFacial.vetor, EmbeddingFacial.dimensao)
        .join(Aluno, Aluno.id == EmbeddingFacial.aluno_id)
        .where(Aluno.ativo.is_(True), EmbeddingFacial.modelo == modelo)
        .order_by(EmbeddingFacial.id)  # ordem estável: resultados reproduzíveis
    )
    return [
        (aluno_id, np.frombuffer(vetor, dtype=np.float32, count=dimensao))
        for aluno_id, vetor, dimensao in sessao.execute(consulta)
    ]
