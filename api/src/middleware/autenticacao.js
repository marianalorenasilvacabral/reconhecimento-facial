import { hashToken } from '../services/seguranca.js'

export function exigirEmpresa(banco) {
  return async (req, res, next) => {
    const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{20,200})$/)?.[1]
    if (!token) return res.status(401).json({ erro: 'Entre com a conta da empresa.' })
    const { rows } = await banco.query('SELECT e.id, e.nome, e.responsavel, e.email, e.cnpj, e.cep, e.endereco FROM sessoes_mobile s JOIN empresas_mobile e ON e.id=s.empresa_id WHERE s.token_hash=$1 AND s.expira_em>now()', [hashToken(token)])
    if (!rows.length) return res.status(401).json({ erro: 'Sua sessão expirou. Entre novamente.' })
    req.empresa = rows[0]
    req.token = token
    res.set('Cache-Control', 'no-store')
    next()
  }
}
