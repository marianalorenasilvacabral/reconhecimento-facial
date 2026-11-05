"""Identificação de um quadro de vídeo: encontra o rosto, compara com os cadastrados e decide.

Resultados possíveis (campo `status`):
  sem_rosto            nenhum rosto no quadro
  identificado         correspondência confiável; devolve o cartão do aluno
  nao_identificado     há um rosto, mas nenhum cadastro corresponde
  revisao_necessaria   dúvida (vários rostos, rosto distante, cadastros parecidos...).
                       Nunca mostra dados de ninguém nesse caso.
"""
from sqlalchemy.orm import Session

from database.modelos import Aluno
from database.repositorio import carregar_galeria

from .reconhecimento import MODELO, decidir, distancias_por_aluno
from .validacao import mascarar_cpf


def cartao_do_aluno(aluno: Aluno) -> dict:
    """Só os campos necessários para o cartão; o CPF sempre mascarado."""
    return {
        "id": aluno.id,
        "matricula": aluno.matricula,
        "nome": aluno.nome,
        "data_nascimento": aluno.data_nascimento.isoformat(),
        "cpf": mascarar_cpf(aluno.cpf),
        "turma": aluno.turma,
    }


def identificar_quadro(sessao: Session, servico, conteudo: bytes) -> dict:
    quadro = servico.processar_quadro(conteudo)
    resultado: dict = {"rostos": quadro.rostos, "motivo": None, "distancia": None, "aluno": None}

    if quadro.rostos == 0:
        return {**resultado, "status": "sem_rosto"}
    if quadro.rostos > 1:
        return {
            **resultado,
            "status": "revisao_necessaria",
            "motivo": "Há mais de um rosto na imagem.",
        }
    if quadro.embedding is None:
        return {
            **resultado,
            "status": "revisao_necessaria",
            "motivo": "Rosto pequeno ou distante. Aproxime-se da câmera.",
        }

    decisao = decidir(distancias_por_aluno(quadro.embedding, carregar_galeria(sessao, MODELO)))
    resultado.update(
        status=decisao.status,
        motivo=decisao.motivo,
        distancia=None if decisao.distancia is None else round(decisao.distancia, 3),
    )
    if decisao.status == "identificado":
        aluno = sessao.get(Aluno, decisao.aluno_id)
        if aluno is None or not aluno.ativo:
            return {**resultado, "status": "nao_identificado"}
        resultado["aluno"] = cartao_do_aluno(aluno)
    return resultado
