export const duracao = (segundos = 0) => {
  const minutos = Math.floor(Math.max(0, segundos) / 60)
  return `${Math.floor(minutos / 60)}h ${String(minutos % 60).padStart(2, '0')}min`
}
export const hora = (valor) => valor ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(valor)) : '—'
export const dataCurta = (dia) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
export const mesAtual = () => {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  return `${partes.find((p) => p.type === 'year').value}-${partes.find((p) => p.type === 'month').value}`
}
export const moverMes = (mes, direcao) => {
  const data = new Date(`${mes}-15T12:00:00Z`)
  data.setUTCMonth(data.getUTCMonth() + direcao)
  return data.toISOString().slice(0, 7)
}
export const nomeMes = (mes) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${mes}-15T12:00:00Z`))
export const iniciais = (nome = '') => nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase()
