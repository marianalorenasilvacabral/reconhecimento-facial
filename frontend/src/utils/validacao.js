// Constantes e validações compartilhadas pela tela de cadastro.

export const TOTAL_FOTOS = 5
export const ROTULOS_FOTOS = [
  'Frontal',
  'Giro leve à esquerda',
  'Giro leve à direita',
  'Expressão diferente',
  'Outra iluminação',
]
export const TIPOS_ACEITOS = ['image/jpeg', 'image/png']
export const TAMANHO_MAX_MB = 5

export const apenasDigitos = (valor) => String(valor ?? '').replace(/\D/g, '')

export function formatarCpf(valor) {
  const d = apenasDigitos(valor).slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function mascararCpf(valor) {
  const d = apenasDigitos(valor)
  return d.length === 11 ? `***.***.***-${d.slice(9)}` : '—'
}

export function cpfValido(valor) {
  const d = apenasDigitos(valor)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false

  const digito = (base) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return digito(d.slice(0, 9)) === Number(d[9]) && digito(d.slice(0, 10)) === Number(d[10])
}

export function hojeIso() {
  const agora = new Date()
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${agora.getFullYear()}-${mes}-${dia}`
}

export function formatarData(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '')) return '—'
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

function dataExiste(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(a, m - 1, d)
  return data.getFullYear() === a && data.getMonth() === m - 1 && data.getDate() === d
}

export function validarDados({ nome, nascimento, cpf }) {
  const erros = {}

  const nomeLimpo = nome.trim().replace(/\s+/g, ' ')
  if (!nomeLimpo) {
    erros.nome = 'Informe o nome completo.'
  } else if (!nomeLimpo.includes(' ')) {
    erros.nome = 'Informe nome e sobrenome.'
  } else if (nomeLimpo.length > 120) {
    erros.nome = 'O nome pode ter no máximo 120 caracteres.'
  } else if (!/^\p{L}[\p{L}\s'.-]*$/u.test(nomeLimpo)) {
    erros.nome = 'Use apenas letras, espaços, hífen, apóstrofo ou ponto.'
  }

  if (!nascimento) {
    erros.nascimento = 'Informe a data de nascimento.'
  } else if (!dataExiste(nascimento)) {
    erros.nascimento = 'Data inválida.'
  } else if (nascimento > hojeIso()) {
    erros.nascimento = 'A data de nascimento não pode estar no futuro.'
  } else if (nascimento < '1900-01-01') {
    erros.nascimento = 'Data muito antiga. Confira o ano.'
  }

  if (!apenasDigitos(cpf)) {
    erros.cpf = 'Informe o CPF.'
  } else if (!cpfValido(cpf)) {
    erros.cpf = 'CPF inválido. Confira os dígitos.'
  }

  return erros
}

export function validarFotos(fotos) {
  const faltando = fotos.filter((f) => !f).length
  if (faltando === 0) return null
  return faltando === 1
    ? 'Falta 1 foto. Capture ou envie as 5 imagens.'
    : `Faltam ${faltando} fotos. Capture ou envie as 5 imagens.`
}
