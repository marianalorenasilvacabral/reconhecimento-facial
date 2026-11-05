const FUSO = 'America/Sao_Paulo'

export function formatarHorario(valor) {
  if (!valor) return '—'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(data)
}

export function formatarDuracao(segundos) {
  const total = Math.max(0, Math.floor(Number(segundos) || 0))
  const horas = Math.floor(total / 3600)
  const minutos = Math.floor((total % 3600) / 60)
  const resto = total % 60
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
}
