"""Avalia os limites com fotos separadas das usadas no cadastro, sem acessar o banco.

Estrutura: pasta/participante_01/cadastro/ (5 fotos), pasta/participante_01/teste/ (fotos inéditas).
Inclua pasta/desconhecidos/ com fotos de pessoas ausentes do cadastro.
Use identificadores fictícios nas pastas e fotos de participantes autorizados.
"""
import argparse
import json
from collections import Counter
from pathlib import Path

from . import reconhecimento as rec


def fotos(pasta: Path) -> list[Path]:
    return sorted(p for p in pasta.iterdir() if p.suffix.lower() in {'.jpg', '.jpeg', '.png'})


def avaliar(pasta: Path) -> dict:
    servico = rec.obter_servico_facial()
    galeria, consultas, participantes = [], [], {}
    for diretorio in sorted(p for p in pasta.iterdir() if p.is_dir() and p.name != 'desconhecidos'):
        cadastro, teste = diretorio / 'cadastro', diretorio / 'teste'
        if not cadastro.is_dir() or not teste.is_dir():
            raise ValueError(f'{diretorio.name}: crie as subpastas cadastro e teste.')
        referencias, ineditas = fotos(cadastro), fotos(teste)
        if len(referencias) != 5 or not ineditas:
            raise ValueError(f'{diretorio.name}: são necessárias 5 fotos de cadastro e ao menos 1 de teste.')
        # Não permite usar a mesma foto no cadastro e na avaliação.
        conteudos = [p.read_bytes() for p in referencias]
        if any(p.read_bytes() in conteudos for p in ineditas):
            raise ValueError(f'{diretorio.name}: as fotos de teste precisam ser inéditas.')
        vetores = [servico.extrair_unico(conteudo) for conteudo in conteudos]
        rec.verificar_consistencia(vetores)
        identificador = len(participantes) + 1
        participantes[identificador] = diretorio.name
        galeria.extend((identificador, vetor) for vetor in vetores)
        consultas.extend((identificador, caminho) for caminho in ineditas)
    if len(participantes) < 2:
        raise ValueError('Use ao menos dois participantes diferentes para avaliar confusões.')
    desconhecidos = pasta / 'desconhecidos'
    if not desconhecidos.is_dir() or not fotos(desconhecidos):
        raise ValueError('Inclua fotos em desconhecidos para avaliar pessoas não cadastradas.')
    consultas.extend((None, caminho) for caminho in fotos(desconhecidos))

    resultados = []
    for esperado, caminho in consultas:
        quadro = servico.processar_quadro(caminho.read_bytes())
        distancias = rec.distancias_por_aluno(quadro.embedding, galeria) if quadro.embedding is not None else {}
        ordenadas = sorted(distancias.items(), key=lambda item: item[1])
        decisao = rec.decidir(distancias) if quadro.embedding is not None else None
        status = decisao.status if decisao else ('sem_rosto' if quadro.rostos == 0 else 'revisao_necessaria')
        obtido = decisao.aluno_id if decisao else None
        if obtido is not None and obtido != esperado:
            categoria = 'identificacao_incorreta' if esperado is not None else 'falsa_aceitacao'
        elif esperado is not None and obtido is None:
            categoria = 'revisao' if status == 'revisao_necessaria' else 'nao_reconhecido'
        else:
            categoria = 'reconhecido_corretamente' if esperado is not None else 'desconhecido_sem_identificacao'
        resultados.append({
            'arquivo': str(caminho.relative_to(pasta)),
            'esperado': participantes.get(esperado),
            'identificado': participantes.get(obtido),
            'status': status,
            'categoria': categoria,
            'menor_distancia': ordenadas[0][1] if ordenadas else None,
            'margem_segundo': ordenadas[1][1] - ordenadas[0][1] if len(ordenadas) > 1 else None,
        })
    return {
        'modelo': rec.MODELO,
        'limites': {nome: getattr(rec, nome) for nome in ('LIMITE_DISTANCIA', 'FAIXA_INCERTA', 'MARGEM_AMBIGUIDADE', 'LIMITE_CONSISTENCIA', 'LADO_MIN_ROSTO')},
        'participantes': len(participantes),
        'total_avaliado': len(resultados),
        'contagem': dict(Counter(r['categoria'] for r in resultados)),
        'resultados': resultados,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pasta', required=True, type=Path)
    parser.add_argument('--saida', type=Path, default=Path('calibracao.json'))
    argumentos = parser.parse_args()
    try:
        relatorio = avaliar(argumentos.pasta)
    except (OSError, ValueError, rec.ReconhecimentoIndisponivel) as erro:
        parser.exit(1, f'Não foi possível avaliar: {erro}\n')
    argumentos.saida.write_text(json.dumps(relatorio, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(relatorio['contagem'], ensure_ascii=False, indent=2))
    print(f'Relatório salvo em {argumentos.saida}. Revise os erros antes de ajustar os limites no .env.')


if __name__ == '__main__':
    main()
