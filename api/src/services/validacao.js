import { z } from 'zod'

const horario = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use horários no formato HH:MM.')
export const jornadaSchema = z.object({
  entrada: horario, saidaAlmoco: horario, retornoAlmoco: horario, saida: horario,
  diasSemana: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  toleranciaMinutos: z.number().int().min(0).max(60).default(0),
}).refine((j) => j.entrada < j.saidaAlmoco && j.saidaAlmoco < j.retornoAlmoco && j.retornoAlmoco < j.saida, 'A jornada deve seguir: entrada, saída para almoço, retorno e saída final, no mesmo dia.')

export const cadastroEmpresaSchema = z.object({
  nome: z.string().trim().min(3).max(120), responsavel: z.string().trim().min(3).max(120),
  email: z.email().max(200).transform((v) => v.toLowerCase()), senha: z.string().min(8).max(128),
  cnpj: z.string().regex(/^\d{14}$/).optional().or(z.literal('')),
  cep: z.string().regex(/^\d{8}$/).optional().or(z.literal('')),
  endereco: z.object({ logradouro: z.string().max(200).optional(), bairro: z.string().max(100).optional(), cidade: z.string().max(100).optional(), uf: z.string().max(2).optional() }).default({}),
  aceite: z.literal(true, { error: 'Confirme a autorização de uso do aplicativo.' }),
})
export const loginSchema = z.object({ email: z.email().max(200).transform((v) => v.toLowerCase()), senha: z.string().min(1).max(128) })
export const funcionarioSchema = z.object({
  nome: z.string().trim().min(3).max(120), cargo: z.string().trim().max(80).default(''),
  cpf: z.string().regex(/^\d{11}$/).refine(cpfValido, 'CPF inválido.'),
  nascimento: z.iso.date().refine((v) => v >= '1900-01-01' && v <= new Date().toISOString().slice(0, 10), 'Data de nascimento inválida.'),
  ativo: z.boolean().default(true), jornada: jornadaSchema,
  autorizado: z.literal(true, { error: 'Confirme a autorização das fotos.' }),
  fotos: z.array(z.string().min(20).max(7_000_000)).length(5, 'Envie cinco fotos do rosto.'),
})
export const edicaoFuncionarioSchema = funcionarioSchema.pick({ nome: true, cargo: true, ativo: true, jornada: true })

export function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false
  const digito = (parte) => {
    const soma = [...parte].reduce((total, n, i) => total + Number(n) * (parte.length + 1 - i), 0)
    const valor = (soma * 10) % 11
    return valor === 10 ? 0 : valor
  }
  return digito(cpf.slice(0, 9)) === Number(cpf[9]) && digito(cpf.slice(0, 10)) === Number(cpf[10])
}

export function validar(schema, dados) {
  const resultado = schema.safeParse(dados)
  if (!resultado.success) {
    const erro = new Error(resultado.error.issues[0]?.message || 'Confira os dados informados.')
    erro.status = 422
    throw erro
  }
  return resultado.data
}
