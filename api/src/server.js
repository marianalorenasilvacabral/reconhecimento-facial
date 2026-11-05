import { criarApp } from './app.js'
import { migrar } from './database/migrate.js'
import { configuracao } from './config.js'
import { pool } from './database/pool.js'

try {
  if (!configuracao.banco) throw new Error('DATABASE_URL ausente')
  await migrar()
  const servidor = criarApp().listen(configuracao.porta, configuracao.host, () => console.log(`API mobile pronta em http://127.0.0.1:${configuracao.porta}`))
  servidor.on('error', () => { console.error('Não foi possível iniciar a API. Confira a porta configurada.'); process.exitCode = 1; pool.end() })
  const encerrar = () => servidor.close(() => pool.end())
  process.on('SIGINT', encerrar)
  process.on('SIGTERM', encerrar)
} catch {
  console.error('Falha ao iniciar a API mobile. Confira o PostgreSQL e execute a criação das tabelas do sistema facial.')
  await pool.end()
  process.exitCode = 1
}
