/**
 * Regras que decidem o que a tela mostra, a partir dos resultados que a API devolve quadro a quadro.
 * São funções puras (sem React), para poderem ser testadas em separado.
 *
 * Objetivos:
 *  - o cartão só aparece após duas confirmações consecutivas do MESMO aluno;
 *  - o cartão é limpo imediatamente se houver dúvida, outro aluno ou nenhum rosto;
 *  - resultados inválidos também removem os dados exibidos.
 */

export const CONFIRMACOES = 2 // quantos deles precisam apontar o mesmo aluno
export const TEMPO_SEM_RESULTADO_MS = 4000

export const ESTADO_INICIAL = Object.freeze({
  candidatoId: null,
  confirmacoes: 0,
  aluno: null, // cartão exibido
  mensagem: 'Aguardando rosto',
  tom: 'neutro', // neutro | ok | atencao
})

const TEXTOS = {
  naoConfirmada: 'Identificação não confirmada',
  naoIdentificado: 'Aluno não identificado',
  identificado: 'Aluno identificado',
}

/** Recebe o estado atual e o resultado de um quadro; devolve o novo estado. */
export function proximoEstado(estado, resultado) {
  const sem = { ...ESTADO_INICIAL }
  if (!resultado || typeof resultado.status !== 'string') return sem
  if (resultado.status === 'sem_rosto') return sem
  if (resultado.status === 'nao_identificado') return { ...sem, mensagem: TEXTOS.naoIdentificado, tom: 'atencao' }
  if (resultado.status === 'revisao_necessaria') {
    return { ...sem, mensagem: resultado.motivo || TEXTOS.naoConfirmada, tom: 'atencao' }
  }
  if (resultado.status !== 'identificado' || resultado.rostos !== 1 || resultado.aluno?.id == null) return sem
  const candidatoId = resultado.aluno.id
  const confirmacoes = candidatoId === estado.candidatoId
    ? Math.min(estado.confirmacoes + 1, CONFIRMACOES)
    : 1
  const confirmado = confirmacoes >= CONFIRMACOES
  return {
    candidatoId,
    confirmacoes,
    aluno: confirmado ? resultado.aluno : null,
    mensagem: confirmado ? TEXTOS.identificado : 'Confirmando identificação…',
    tom: confirmado ? 'ok' : 'neutro',
  }
}
