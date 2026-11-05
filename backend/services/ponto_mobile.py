"""Quatro marcações para funcionários vinculados pelo aplicativo empresarial."""
import json
from zoneinfo import ZoneInfo

from sqlalchemy import text

CAMPOS = ('entrada', 'saida_almoco', 'retorno_almoco', 'saida')


def buscar_funcionario_mobile(sessao, aluno_id):
    if sessao.scalar(text("SELECT to_regclass('public.funcionarios_mobile')")) is None:
        return None
    return sessao.execute(text('SELECT id, jornada, ativo FROM funcionarios_mobile WHERE aluno_id=:aluno'), {'aluno': aluno_id}).mappings().first()


def marcar_mobile(sessao, funcionario, agora):
    dia = agora.astimezone(ZoneInfo('America/Sao_Paulo')).date()
    registro = sessao.execute(text('SELECT * FROM pontos_mobile WHERE funcionario_id=:id AND data=:dia FOR UPDATE'), {'id': funcionario['id'], 'dia': dia}).mappings().first()
    if registro is None:
        sessao.execute(text('INSERT INTO pontos_mobile(funcionario_id,data,entrada,jornada) VALUES(:id,:dia,:agora,CAST(:jornada AS jsonb))'),
                       {'id': funcionario['id'], 'dia': dia, 'agora': agora, 'jornada': json.dumps(funcionario['jornada'])})
        return
    for campo in CAMPOS[1:]:
        if registro[campo] is None:
            sessao.execute(text(f'UPDATE pontos_mobile SET {campo}=:agora WHERE id=:id'), {'agora': agora, 'id': registro['id']})
            return


def resumo_mobile(sessao, funcionario, agora):
    registro = sessao.execute(text('SELECT * FROM pontos_mobile WHERE funcionario_id=:id ORDER BY data DESC LIMIT 1'), {'id': funcionario['id']}).mappings().first()
    if registro is None:
        return None
    movimento = next(campo for campo in reversed(CAMPOS) if registro[campo] is not None)
    segundos = 0
    for inicio, fim in (('entrada', 'saida_almoco'), ('retorno_almoco', 'saida')):
        if registro[inicio] is not None:
            segundos += max(0, int(((registro[fim] or agora) - registro[inicio]).total_seconds()))
    return {
        'id': registro['id'], 'movimento': movimento, 'jornada_empresarial': True,
        **{campo: registro[campo].isoformat() if registro[campo] else None for campo in CAMPOS},
        'duracao_segundos': segundos,
    }
