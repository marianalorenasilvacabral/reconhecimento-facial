"""Gera os embeddings (vetores faciais) dos alunos cadastrados ANTES do reconhecimento existir.

Uso (dentro de backend/, com o .venv ativo):
    python -m services.gerar_embeddings            # só alunos que ainda não têm embeddings
    python -m services.gerar_embeddings --todos    # refaz de todos (apaga os vetores atuais)

Um aluno só é atualizado se as 5 fotos tiverem exatamente um rosto e forem da mesma pessoa.
Os que não passarem são listados com o motivo e ficam como estavam (não serão reconhecidos
até que o cadastro seja refeito com fotos adequadas).
"""
import argparse

from sqlalchemy import select

from database.conexao import nova_sessao
from database.modelos import Aluno, EmbeddingFacial
from database.repositorio import guardar_embedding

from .reconhecimento import MODELO, ProblemaNaFoto, obter_servico_facial, verificar_consistencia


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--todos", action="store_true", help="refaz os embeddings de todos os alunos")
    argumentos = parser.parse_args()

    servico = obter_servico_facial()
    atualizados, falhas = 0, []

    with nova_sessao() as sessao:
        alunos = list(sessao.scalars(select(Aluno).where(Aluno.ativo.is_(True)).order_by(Aluno.id)))
        for aluno in alunos:
            tem = sessao.scalar(
                select(EmbeddingFacial.id).where(EmbeddingFacial.aluno_id == aluno.id).limit(1)
            )
            if tem and not argumentos.todos:
                continue
            try:
                vetores = []
                for imagem in aluno.imagens:
                    try:
                        vetores.append(servico.extrair_unico(imagem.conteudo))
                    except ProblemaNaFoto as erro:
                        raise ProblemaNaFoto(f"foto {imagem.posicao}: {erro}") from erro
                verificar_consistencia(vetores)
            except ProblemaNaFoto as erro:
                falhas.append((aluno.matricula, aluno.nome, str(erro)))
                continue

            for imagem in aluno.imagens:
                if imagem.embedding is not None:
                    sessao.delete(imagem.embedding)
            sessao.flush()
            for imagem, vetor in zip(aluno.imagens, vetores):
                guardar_embedding(sessao, aluno.id, imagem.id, vetor, MODELO)
            sessao.commit()
            atualizados += 1
            print(f"OK    {aluno.matricula}  {aluno.nome}")

    for matricula, nome, motivo in falhas:
        print(f"FALHA {matricula}  {nome}: {motivo}")
    print(f"\n{atualizados} aluno(s) atualizado(s); {len(falhas)} com problema.")


if __name__ == "__main__":
    main()
