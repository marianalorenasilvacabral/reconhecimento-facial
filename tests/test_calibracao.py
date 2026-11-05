"""Verifica a avaliação com fotos inéditas e pessoas ausentes do cadastro."""
import pytest

from falso_facial import ServicoFalso
from services import calibrar

pytestmark = pytest.mark.sem_banco


@pytest.fixture()
def amostra(tmp_path, monkeypatch):
    monkeypatch.setattr(calibrar.rec, 'obter_servico_facial', lambda: ServicoFalso())
    for pessoa in (1, 2):
        cadastro = tmp_path / f'participante_{pessoa}' / 'cadastro'
        teste = cadastro.parent / 'teste'
        cadastro.mkdir(parents=True)
        teste.mkdir()
        for i in range(5):
            (cadastro / f'{i}.jpg').write_bytes(f'PESSOA={pessoa} referencia-{i}'.encode())
        (teste / 'inedita.jpg').write_bytes(f'PESSOA={pessoa} inedita'.encode())
    (tmp_path / 'desconhecidos').mkdir()
    (tmp_path / 'desconhecidos' / 'outra.jpg').write_bytes(b'PESSOA=7 desconhecido')
    return tmp_path


def test_avaliacao_separa_fotos_ineditas_e_pessoas_desconhecidas(amostra):
    relatorio = calibrar.avaliar(amostra)
    assert relatorio['participantes'] == 2
    assert relatorio['total_avaliado'] == 3
    assert relatorio['contagem'] == {'reconhecido_corretamente': 2, 'desconhecido_sem_identificacao': 1}
    assert all(r['menor_distancia'] is not None for r in relatorio['resultados'])


def test_avaliacao_recusa_reaproveitar_foto_do_cadastro(amostra):
    participante = amostra / 'participante_1'
    (participante / 'teste' / 'inedita.jpg').write_bytes((participante / 'cadastro' / '0.jpg').read_bytes())
    with pytest.raises(ValueError, match='inéditas'):
        calibrar.avaliar(amostra)


def test_relatorio_conta_falsa_aceitacao(amostra):
    # A pessoa do cadastro foi rotulada como desconhecida: o relatório precisa acusar o erro.
    (amostra / 'desconhecidos' / 'outra.jpg').write_bytes(b'PESSOA=1 outra-foto')
    assert calibrar.avaliar(amostra)['contagem']['falsa_aceitacao'] == 1
