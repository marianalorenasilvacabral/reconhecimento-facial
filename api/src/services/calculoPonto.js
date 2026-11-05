const fuso = 'America/Sao_Paulo'
export const dataLocal = (valor = new Date()) => {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(valor))
  const ler = (tipo) => partes.find((p) => p.type === tipo).value
  return `${ler('year')}-${ler('month')}-${ler('day')}`
}
const segundosHorario = (valor) => Number(valor.slice(0, 2)) * 3600 + Number(valor.slice(3, 5)) * 60
const segundosLocal = (valor) => {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: fuso, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(valor))
  const ler = (tipo) => Number(partes.find((p) => p.type === tipo).value)
  return ler('hour') * 3600 + ler('minute') * 60 + ler('second')
}
const intervalo = (inicio, fim) => inicio && fim ? Math.max(0, Math.floor((new Date(fim) - new Date(inicio)) / 1000)) : 0

export function calcularDia(ponto) {
  const jornada = ponto.jornada
  const dia = typeof ponto.data === 'string' ? ponto.data.slice(0, 10) : dataLocal(ponto.entrada)
  const semana = new Date(`${dia}T12:00:00-03:00`).getUTCDay() || 7
  const previsto = jornada.diasSemana.includes(semana)
    ? segundosHorario(jornada.saidaAlmoco) - segundosHorario(jornada.entrada) + segundosHorario(jornada.saida) - segundosHorario(jornada.retornoAlmoco) : 0
  const trabalhado = intervalo(ponto.entrada, ponto.saida_almoco) + intervalo(ponto.retorno_almoco, ponto.saida)
  const tolerancia = jornada.toleranciaMinutos * 60
  const atraso = previsto ? Math.max(0, segundosLocal(ponto.entrada) - segundosHorario(jornada.entrada) - tolerancia)
    + (ponto.retorno_almoco ? Math.max(0, segundosLocal(ponto.retorno_almoco) - segundosHorario(jornada.retornoAlmoco) - tolerancia) : 0) : 0
  const completo = Boolean(ponto.entrada && ponto.saida_almoco && ponto.retorno_almoco && ponto.saida)
  return { ...ponto, data: dia, trabalhadoSegundos: trabalhado, previstoSegundos: previsto, atrasoSegundos: atraso, extraSegundos: completo ? Math.max(0, trabalhado - previsto) : 0, completo }
}

export function calcularMes(pontos) {
  const dias = pontos.map(calcularDia)
  const totais = dias.reduce((total, dia) => ({
    trabalhadoSegundos: total.trabalhadoSegundos + dia.trabalhadoSegundos,
    atrasoSegundos: total.atrasoSegundos + dia.atrasoSegundos,
    extraSegundos: total.extraSegundos + dia.extraSegundos,
    diasCompletos: total.diasCompletos + Number(dia.completo),
    diasPendentes: total.diasPendentes + Number(!dia.completo),
  }), { trabalhadoSegundos: 0, atrasoSegundos: 0, extraSegundos: 0, diasCompletos: 0, diasPendentes: 0 })
  return { dias, totais }
}
