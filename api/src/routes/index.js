import { Router } from 'express'
import { authController } from '../controllers/authController.js'
import { funcionarioController } from '../controllers/funcionarioController.js'
import { exigirEmpresa } from '../middleware/autenticacao.js'

export function criarRotas(banco, analisarFotos) {
  const router = Router()
  const auth = authController(banco)
  const funcionarios = funcionarioController(banco, analisarFotos)
  const tentativas = new Map()
  function limitar(req, res, next) {
    const agora = Date.now()
    const chave = req.ip
    const atual = (tentativas.get(chave) || []).filter((t) => agora - t < 60_000)
    if (atual.length >= 10) return res.status(429).json({ erro: 'Muitas tentativas. Aguarde um minuto.' })
    atual.push(agora)
    tentativas.set(chave, atual)
    if (tentativas.size > 1000) for (const [ip, lista] of tentativas) if (!lista.some((t) => agora - t < 60_000)) tentativas.delete(ip)
    next()
  }
  router.post('/auth/cadastro', limitar, auth.cadastrar)
  router.post('/auth/login', limitar, auth.entrar)
  router.use(exigirEmpresa(banco))
  router.post('/auth/logout', auth.sair)
  router.get('/empresa', auth.empresa)
  router.param('id', (req, res, next, id) => /^\d{1,15}$/.test(id) ? next() : res.status(422).json({ erro: 'Identificador inválido.' }))
  router.get('/funcionarios', funcionarios.listar)
  router.post('/funcionarios', funcionarios.cadastrar)
  router.get('/funcionarios/:id/ponto', funcionarios.ponto)
  router.get('/funcionarios/:id', funcionarios.detalhe)
  router.put('/funcionarios/:id', funcionarios.atualizar)
  router.delete('/funcionarios/:id', funcionarios.excluir)
  return router
}
