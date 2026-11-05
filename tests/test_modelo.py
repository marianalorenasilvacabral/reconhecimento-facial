"""Verifica o carregamento do dlib real sem fotos pessoais nem banco de dados."""
import io

import pytest
from PIL import Image

from services.reconhecimento import ProblemaNaFoto, ServicoFacial

pytestmark = pytest.mark.sem_banco


@pytest.fixture(scope='module')
def modelo_real():
    return ServicoFacial()


@pytest.fixture(scope='module')
def sem_rosto():
    saida = io.BytesIO()
    Image.new('RGB', (640, 480), (90, 140, 200)).save(saida, 'JPEG')
    return saida.getvalue()


def test_modelo_real_carrega_e_nao_identifica_imagem_sem_rosto(modelo_real, sem_rosto):
    quadro = modelo_real.processar_quadro(sem_rosto)
    assert quadro.rostos == 0
    assert quadro.embedding is None


def test_modelo_real_recusa_cadastro_sem_rosto(modelo_real, sem_rosto):
    with pytest.raises(ProblemaNaFoto, match='nenhum rosto'):
        modelo_real.extrair_unico(sem_rosto)
