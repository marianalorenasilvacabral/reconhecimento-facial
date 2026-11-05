"""Testes das regras de decisão (sem banco e sem dlib): quando identificar, duvidar ou recusar."""
import numpy as np
import pytest

pytestmark = pytest.mark.sem_banco

from services import reconhecimento as r
from services.reconhecimento import (
    ProblemaNaFoto,
    decidir,
    distancias_por_aluno,
    verificar_consistencia,
)


def test_identifica_quando_ha_um_unico_candidato_dentro_do_limite():
    d = decidir({7: 0.35})
    assert d.status == "identificado" and d.aluno_id == 7 and d.distancia == pytest.approx(0.35)


def test_exatamente_no_limite_ainda_identifica():
    assert decidir({1: r.LIMITE_DISTANCIA}).status == "identificado"


def test_logo_acima_do_limite_pede_revisao():
    d = decidir({1: r.LIMITE_DISTANCIA + 0.01})
    assert d.status == "revisao_necessaria" and d.aluno_id is None
    assert "incerta" in d.motivo


def test_bem_acima_do_limite_nao_identifica():
    d = decidir({1: r.LIMITE_DISTANCIA + r.FAIXA_INCERTA + 0.01, 2: 0.9})
    assert d.status == "nao_identificado" and d.aluno_id is None


def test_dois_cadastros_parecidos_pedem_revisao_em_vez_de_escolher_um():
    d = decidir({1: 0.30, 2: 0.30 + r.MARGEM_AMBIGUIDADE - 0.01})
    assert d.status == "revisao_necessaria" and d.aluno_id is None
    assert "parecido" in d.motivo


def test_segundo_colocado_distante_nao_atrapalha():
    assert decidir({1: 0.30, 2: 0.30 + r.MARGEM_AMBIGUIDADE + 0.01}).status == "identificado"


def test_sem_nenhum_cadastro_nao_identifica():
    d = decidir({})
    assert d.status == "nao_identificado" and d.aluno_id is None


def test_revisao_nunca_devolve_aluno():
    for dist in ({1: 0.52}, {1: 0.3, 2: 0.31}):
        assert decidir(dist).aluno_id is None


def test_distancia_do_aluno_e_a_media_das_duas_melhores_fotos():
    quadro = np.zeros(128, dtype=np.float32)

    def a_distancia(x):
        v = np.zeros(128, dtype=np.float32)
        v[0] = x
        return v

    galeria = [(1, a_distancia(0.2)), (1, a_distancia(0.4)), (1, a_distancia(0.9)), (2, a_distancia(0.6))]
    d = distancias_por_aluno(quadro, galeria)
    assert d[1] == pytest.approx(0.3)  # média de 0,2 e 0,4; a foto de 0,9 não conta
    assert d[2] == pytest.approx(0.6)


def test_uma_foto_parecida_com_outra_pessoa_nao_decide_sozinha():
    quadro = np.zeros(128, dtype=np.float32)
    perto, longe = np.zeros(128, dtype=np.float32), np.zeros(128, dtype=np.float32)
    perto[0], longe[0] = 0.1, 0.9
    d = distancias_por_aluno(quadro, [(1, perto), (1, longe), (1, longe)])
    assert d[1] == pytest.approx(0.5)  # a única foto próxima é diluída pelas outras


def test_vetores_de_tamanho_diferente_sao_ignorados():
    d = distancias_por_aluno(np.zeros(128, np.float32), [(1, np.zeros(64, np.float32))])
    assert d == {}


def test_consistencia_aceita_fotos_da_mesma_pessoa():
    base = np.zeros(128, dtype=np.float32)
    verificar_consistencia([base + i * 0.001 for i in range(5)])


def test_consistencia_aponta_a_foto_de_outra_pessoa():
    iguais = [np.zeros(128, dtype=np.float32) for _ in range(5)]
    outra = np.zeros(128, dtype=np.float32)
    outra[5] = 1.0
    iguais[2] = outra
    with pytest.raises(ProblemaNaFoto, match="Foto 3"):
        verificar_consistencia(iguais)
