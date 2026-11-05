import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
export const hashToken = (token) => createHash('sha256').update(token).digest('hex')

export async function gerarHash(senha) {
  const sal = randomBytes(16).toString('hex')
  const hash = await scrypt(senha, sal, 32)
  return `${sal}:${hash.toString('hex')}`
}

export async function conferirSenha(senha, armazenada) {
  const [sal, valor] = armazenada.split(':')
  const hash = await scrypt(senha, sal, 32)
  const esperado = Buffer.from(valor, 'hex')
  return hash.length === esperado.length && timingSafeEqual(hash, esperado)
}

export async function criarSessao(banco, empresa) {
  const token = randomBytes(32).toString('base64url')
  await banco.query('DELETE FROM sessoes_mobile WHERE expira_em < now()')
  await banco.query('INSERT INTO sessoes_mobile(token_hash, empresa_id, expira_em) VALUES ($1, $2, now() + interval \'7 days\')', [hashToken(token), empresa.id])
  const { senha_hash, ...publica } = empresa
  return { token, empresa: publica }
}
