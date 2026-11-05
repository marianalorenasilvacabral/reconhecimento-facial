"""Uma marcação por aparição confirmada; horários do servidor em UTC."""
import os
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from database.modelos import Aluno, ControlePonto, RegistroPonto
from services.ponto_mobile import buscar_funcionario_mobile, marcar_mobile, resumo_mobile

REARME_SEGUNDOS = max(5.0, float(os.getenv('PONTO_REARME_SEGUNDOS', '5')))


def agora_utc():
    return datetime.now(timezone.utc)


def resumo_ponto(registro: RegistroPonto, agora: datetime) -> dict:
    fim = registro.saida or agora
    return {
        'id': registro.id,
        'movimento': 'saida' if registro.saida else 'entrada',
        'entrada': registro.entrada.isoformat(),
        'saida': registro.saida.isoformat() if registro.saida else None,
        'duracao_segundos': max(0, int((fim - registro.entrada).total_seconds())),
    }


def registrar_reconhecimento(sessao: Session, resultado: dict) -> dict:
    if resultado.get('status') != 'identificado' or resultado.get('rostos') != 1 or not resultado.get('aluno'):
        sessao.execute(update(ControlePonto).where(ControlePonto.marcado_na_aparicao.is_(False)).values(confirmacoes=0))
        sessao.commit()
        return resultado
    aluno_id = resultado['aluno']['id']
    # A linha do aluno sempre existe. O bloqueio serializa requisições de câmeras diferentes.
    aluno = sessao.scalar(select(Aluno).where(Aluno.id == aluno_id).with_for_update())
    if aluno is None or not aluno.ativo:
        return {**resultado, 'status': 'nao_identificado', 'aluno': None}
    agora = agora_utc()
    funcionario_mobile = buscar_funcionario_mobile(sessao, aluno_id)
    controle = sessao.get(ControlePonto, aluno_id)
    if controle is None:
        controle = ControlePonto(aluno_id=aluno_id, ultima_deteccao_em=agora, confirmacoes=1, marcado_na_aparicao=False)
        sessao.add(controle)
    elif (agora - controle.ultima_deteccao_em).total_seconds() >= REARME_SEGUNDOS:
        controle.confirmacoes = 1
        controle.marcado_na_aparicao = False
    else:
        controle.confirmacoes = min(2, controle.confirmacoes + 1)
    controle.ultima_deteccao_em = agora
    if controle.confirmacoes >= 2 and not controle.marcado_na_aparicao:
        if funcionario_mobile:
            marcar_mobile(sessao, funcionario_mobile, agora)
            controle.registro_id = None
        else:
            registro = sessao.scalar(select(RegistroPonto).where(RegistroPonto.aluno_id == aluno_id, RegistroPonto.saida.is_(None)))
            if registro is None:
                registro = RegistroPonto(aluno_id=aluno_id, entrada=agora)
                sessao.add(registro)
            else:
                registro.saida = max(agora, registro.entrada)
            sessao.flush()
            controle.registro_id = registro.id
        controle.marcado_na_aparicao = True
    registro = sessao.get(RegistroPonto, controle.registro_id) if controle.marcado_na_aparicao and controle.registro_id else None
    ponto = resumo_ponto(registro, agora) if registro else None
    if funcionario_mobile and controle.marcado_na_aparicao:
        ponto = resumo_mobile(sessao, funcionario_mobile, agora)
    sessao.commit()
    return {**resultado, 'aluno': {**resultado['aluno'], 'ponto': ponto}}
