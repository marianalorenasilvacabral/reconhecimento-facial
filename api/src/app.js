import express from 'express'
import cors from 'cors'
import { pool } from './database/pool.js'
import { analisarFotos } from './services/facial.js'
import { criarRotas } from './routes/index.js'

export function criarApp({ banco = pool, analisar = analisarFotos } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: (origem, responder) => {
    const permitidas = (process.env.MOBILE_CORS_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081').split(',')
    responder(null, !origem || permitidas.includes(origem))
  } }))
  app.use(express.json({ limit: '35mb' }))
  app.get('/saude', (req, res) => res.json({ status: 'ok', servico: 'ponto-empresa-api' }))
  app.use('/v1', criarRotas(banco, analisar))
  app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }))
  app.use((erro, req, res, next) => {
    if (erro.code === '23505') return res.status(409).json({ erro: 'E-mail ou CPF já cadastrado. Cadastros do site antigo precisam ser migrados com autorização; eles não são vinculados automaticamente.' })
    if (erro.type === 'entity.too.large') return res.status(413).json({ erro: 'As fotos são grandes demais. Selecione imagens menores.' })
    if (erro.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Dados JSON inválidos.' })
    res.status(erro.status || 500).json({ erro: erro.status ? erro.message : 'Não foi possível concluir a operação. Verifique a conexão com o banco.' })
  })
  return app
}
