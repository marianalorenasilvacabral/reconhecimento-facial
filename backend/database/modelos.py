"""Modelos do banco (SQLAlchemy 2). Espelham database/schema.sql.

Dois cuidados importantes:
  - o CPF é guardado só com dígitos (11) e é único;
  - as imagens ficam na tabela imagens_faciais (BYTEA). Não devolva `conteudo` em
    listagens: carregue as imagens somente quando forem realmente necessárias.
"""
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Integer,
    Index,
    LargeBinary,
    Sequence,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

TOTAL_FOTOS = 5


class Base(DeclarativeBase):
    pass


matricula_seq = Sequence("matricula_seq", start=1)


class Aluno(Base):
    __tablename__ = "alunos"
    __table_args__ = (
        CheckConstraint("cpf ~ '^[0-9]{11}$'", name="alunos_cpf_formato"),
        CheckConstraint("length(btrim(nome)) >= 3", name="alunos_nome_nao_vazio"),
        CheckConstraint(
            "data_nascimento >= DATE '1900-01-01' AND data_nascimento <= CURRENT_DATE",
            name="alunos_nascimento_valido",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    matricula: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        server_default=text("gerar_matricula()"),
    )
    nome: Mapped[str] = mapped_column(String(120))
    data_nascimento: Mapped[date] = mapped_column(Date)
    cpf: Mapped[str] = mapped_column(String(11), unique=True)
    turma: Mapped[str | None] = mapped_column(String(60))
    consentimento_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ativo: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    imagens: Mapped[list["ImagemFacial"]] = relationship(
        back_populates="aluno",
        cascade="all, delete-orphan",
        order_by="ImagemFacial.posicao",
    )


class ImagemFacial(Base):
    __tablename__ = "imagens_faciais"
    __table_args__ = (
        UniqueConstraint("aluno_id", "posicao", name="imagens_uma_por_posicao"),
        CheckConstraint("posicao BETWEEN 1 AND 5", name="imagens_posicao_valida"),
        CheckConstraint(
            "tipo_mime IN ('image/jpeg', 'image/png')", name="imagens_tipo_aceito"
        ),
        CheckConstraint(
            "tamanho_bytes > 0 AND tamanho_bytes <= 5 * 1024 * 1024",
            name="imagens_tamanho_valido",
        ),
        CheckConstraint(
            "tamanho_bytes = octet_length(conteudo)", name="imagens_tamanho_confere"
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    aluno_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("alunos.id", ondelete="CASCADE")
    )
    posicao: Mapped[int] = mapped_column(SmallInteger)
    tipo_mime: Mapped[str] = mapped_column(String(20))
    tamanho_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    conteudo: Mapped[bytes] = mapped_column(LargeBinary)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    aluno: Mapped["Aluno"] = relationship(back_populates="imagens")
    embedding: Mapped["EmbeddingFacial | None"] = relationship(
        back_populates="imagem", cascade="all, delete-orphan", uselist=False
    )


class EmbeddingFacial(Base):
    """Vetor de 128 números (float32) que representa o rosto de uma foto."""

    __tablename__ = "embeddings_faciais"
    __table_args__ = (
        CheckConstraint("octet_length(vetor) = dimensao * 4", name="embeddings_tamanho_confere"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    aluno_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("alunos.id", ondelete="CASCADE"), index=True
    )
    imagem_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("imagens_faciais.id", ondelete="CASCADE"), unique=True
    )
    modelo: Mapped[str] = mapped_column(String(40))
    dimensao: Mapped[int] = mapped_column(SmallInteger)
    vetor: Mapped[bytes] = mapped_column(LargeBinary)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    imagem: Mapped["ImagemFacial"] = relationship(back_populates="embedding")


class RegistroPonto(Base):
    __tablename__ = 'registros_ponto'
    __table_args__ = (
        CheckConstraint('saida IS NULL OR saida >= entrada', name='ponto_ordem_horarios'),
        Index('ponto_uma_entrada_aberta', 'aluno_id', unique=True, postgresql_where=text('saida IS NULL')),
        Index('ponto_data_entrada', 'entrada'),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    aluno_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('alunos.id', ondelete='CASCADE'))
    entrada: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    saida: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ControlePonto(Base):
    __tablename__ = 'controle_ponto'

    aluno_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('alunos.id', ondelete='CASCADE'), primary_key=True)
    ultima_deteccao_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    confirmacoes: Mapped[int] = mapped_column(SmallInteger, default=1)
    marcado_na_aparicao: Mapped[bool] = mapped_column(Boolean, default=False)
    registro_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey('registros_ponto.id', ondelete='SET NULL'))


class Administrador(Base):
    __tablename__ = 'administradores'
    __table_args__ = (CheckConstraint('id = 1'),)

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=False, default=1)
    usuario: Mapped[str] = mapped_column(String(60), unique=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SessaoAdmin(Base):
    __tablename__ = 'sessoes_admin'

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    administrador_id: Mapped[int] = mapped_column(SmallInteger, ForeignKey('administradores.id', ondelete='CASCADE'))
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
