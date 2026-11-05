"""Testes do banco (tabelas, restrições e embeddings). Veja tests/conftest.py para a configuração."""
from datetime import date

import numpy as np
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DataError, IntegrityError

from database.conexao import nova_sessao, obter_engine
from database.criar_tabelas import main as criar_tabelas
from database.modelos import Aluno, EmbeddingFacial, ImagemFacial
from database.repositorio import CpfDuplicado, buscar_por_nome, carregar_galeria, criar_aluno

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 100  # conteúdo fictício; o banco só guarda os bytes


def cinco_fotos(tamanho_extra: int = 0):
    return [(JPEG + bytes([i]) * tamanho_extra, "image/jpeg") for i in range(5)]


def novo(sessao, cpf="52998224725", nome="João da Silva", fotos=None, **extra):
    return criar_aluno(
        sessao,
        nome=nome,
        data_nascimento=date(2008, 3, 15),
        cpf=cpf,
        fotos=fotos or cinco_fotos(),
        **extra,
    )


def vetores(base: float, n: int = 5):
    return [np.full(128, base + i * 0.001, dtype=np.float32) for i in range(n)]


def test_cadastro_completo_salva_aluno_e_cinco_imagens():
    with nova_sessao() as s:
        aluno = novo(s)
        assert aluno.matricula.endswith("001")
        assert aluno.consentimento_em is not None
    with nova_sessao() as s:
        salvo = s.query(Aluno).one()
        assert salvo.nome == "João da Silva"
        assert [i.posicao for i in salvo.imagens] == [1, 2, 3, 4, 5]
        assert all(len(i.sha256) == 64 for i in salvo.imagens)


def test_matriculas_sao_sequenciais():
    with nova_sessao() as s:
        a = novo(s, cpf="52998224725")
        b = novo(s, cpf="11144477735", nome="Maria Souza")
        assert int(b.matricula) == int(a.matricula) + 1


def test_matricula_nao_trunca_apos_999_e_atualizacao_preserva_cadastros():
    with nova_sessao() as s:
        anterior = novo(s)
        matricula_anterior = anterior.matricula
        s.execute(text("ALTER SEQUENCE matricula_seq RESTART WITH 999"))
        s.commit()
    criar_tabelas()
    with nova_sessao() as s:
        a = novo(s, cpf="11144477735", nome="Maria Souza")
        b = novo(s, cpf="39053344705", nome="Pedro Lima")
        assert a.matricula.endswith('999')
        assert b.matricula == a.matricula[:4] + '1000'
        assert s.get(Aluno, anterior.id).matricula == matricula_anterior


def test_cpf_duplicado_e_bloqueado_e_nao_deixa_imagens_orfas():
    with nova_sessao() as s:
        novo(s)
    with nova_sessao() as s:
        with pytest.raises(CpfDuplicado):
            novo(s, nome="Outra Pessoa", embeddings=vetores(0.1), modelo="m")
    with nova_sessao() as s:
        assert s.query(Aluno).count() == 1
        assert s.query(ImagemFacial).count() == 5
        assert s.query(EmbeddingFacial).count() == 0


def test_exige_exatamente_cinco_fotos():
    with nova_sessao() as s:
        with pytest.raises(ValueError):
            novo(s, fotos=cinco_fotos()[:4])


@pytest.mark.parametrize("cpf", ["123", "1234567890a", "529.982.247-25"])
def test_cpf_com_formato_invalido_e_recusado(cpf):
    with nova_sessao() as s:
        with pytest.raises((IntegrityError, DataError)):
            novo(s, cpf=cpf)


def test_tipo_de_imagem_nao_aceito_e_recusado():
    fotos = cinco_fotos()
    fotos[2] = (JPEG, "application/pdf")
    with nova_sessao() as s:
        with pytest.raises(IntegrityError):
            novo(s, fotos=fotos)
    with nova_sessao() as s:
        assert s.query(Aluno).count() == 0  # nada ficou salvo pela metade


def test_imagem_maior_que_5mb_e_recusada():
    fotos = cinco_fotos()
    fotos[0] = (b"\xff" * (5 * 1024 * 1024 + 1), "image/jpeg")
    with nova_sessao() as s:
        with pytest.raises(IntegrityError):
            novo(s, fotos=fotos)


def test_nascimento_no_futuro_e_recusado():
    with nova_sessao() as s:
        with pytest.raises(IntegrityError):
            criar_aluno(
                s, nome="Ana Maria", data_nascimento=date(2999, 1, 1),
                cpf="52998224725", fotos=cinco_fotos(),
            )


def test_duas_imagens_na_mesma_posicao_sao_recusadas():
    with nova_sessao() as s:
        aluno = novo(s)
        s.add(ImagemFacial(aluno_id=aluno.id, posicao=1, tipo_mime="image/png",
                           tamanho_bytes=3, sha256="0" * 64, conteudo=b"abc"))
        with pytest.raises(IntegrityError):
            s.commit()


def test_apagar_aluno_apaga_as_imagens_e_os_embeddings():
    with nova_sessao() as s:
        aluno = novo(s, embeddings=vetores(0.1), modelo="m")
        s.delete(aluno)
        s.commit()
    with nova_sessao() as s:
        assert s.query(ImagemFacial).count() == 0
        assert s.query(EmbeddingFacial).count() == 0


def test_busca_por_nome_ignora_maiuscula_e_inativos():
    with nova_sessao() as s:
        novo(s, cpf="52998224725", nome="João da Silva")
        inativo = novo(s, cpf="11144477735", nome="João Pereira")
        inativo.ativo = False
        s.commit()
    with nova_sessao() as s:
        achados = buscar_por_nome(s, "joão")
        assert [a.nome for a in achados] == ["João da Silva"]


def test_atualizado_em_muda_ao_editar():
    with nova_sessao() as s:
        aluno = novo(s)
        antes = aluno.atualizado_em
    with nova_sessao() as s:
        aluno = s.query(Aluno).one()
        aluno.turma = "2º ano - Turma A"
        s.commit()
        s.refresh(aluno)
        assert aluno.atualizado_em > antes


def test_criar_tabelas_pode_rodar_duas_vezes():
    criar_tabelas()
    criar_tabelas()


# ------------------------------------------------------------------ embeddings


def test_embeddings_sao_guardados_um_por_foto_e_recuperados_sem_perda():
    originais = vetores(0.25)
    with nova_sessao() as s:
        aluno = novo(s, embeddings=originais, modelo="modelo_x")
        aluno_id = aluno.id
    with nova_sessao() as s:
        assert s.query(EmbeddingFacial).count() == 5
        galeria = carregar_galeria(s, "modelo_x")
        assert len(galeria) == 5
        assert all(a == aluno_id and v.shape == (128,) for a, v in galeria)
        assert np.allclose(galeria[0][1], originais[0])
        # cada embedding pertence à imagem da mesma posição
        imagens = s.query(ImagemFacial).order_by(ImagemFacial.posicao).all()
        assert [i.embedding is not None for i in imagens] == [True] * 5


def test_galeria_ignora_inativos_e_outros_modelos():
    with nova_sessao() as s:
        novo(s, cpf="52998224725", embeddings=vetores(0.1), modelo="a")
        b = novo(s, cpf="11144477735", nome="Maria Souza", embeddings=vetores(0.2), modelo="a")
        novo(s, cpf="39053344705", nome="Pedro Lima", embeddings=vetores(0.3), modelo="outro")
        b.ativo = False
        s.commit()
    with nova_sessao() as s:
        assert len(carregar_galeria(s, "a")) == 5  # só o aluno ativo do modelo "a"


def test_cadastro_sem_embeddings_continua_valido():
    with nova_sessao() as s:
        novo(s)
    with nova_sessao() as s:
        assert carregar_galeria(s, "m") == []


def test_embeddings_exigem_um_por_foto_e_o_nome_do_modelo():
    with nova_sessao() as s:
        with pytest.raises(ValueError):
            novo(s, embeddings=vetores(0.1, n=4), modelo="m")
        with pytest.raises(ValueError):
            novo(s, embeddings=vetores(0.1), modelo=None)


def test_banco_recusa_embedding_com_tamanho_inconsistente():
    with nova_sessao() as s:
        aluno = novo(s)
        imagem_id = aluno.imagens[0].id
        aluno_id = aluno.id
    with obter_engine().connect() as c:
        with pytest.raises(IntegrityError):
            c.execute(
                text(
                    "INSERT INTO embeddings_faciais (aluno_id, imagem_id, modelo, dimensao, vetor) "
                    "VALUES (:a, :i, 'm', 128, '\\x00'::bytea)"
                ),
                {"a": aluno_id, "i": imagem_id},
            )
