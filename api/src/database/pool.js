import pg from 'pg'
import { configuracao } from '../config.js'

export const pool = new pg.Pool({ connectionString: configuracao.banco, connectionTimeoutMillis: 5000, max: 8 })

export async function transacao(banco, operacao) {
  const conexao = await banco.connect()
  try {
    await conexao.query('BEGIN')
    const resultado = await operacao(conexao)
    await conexao.query('COMMIT')
    return resultado
  } catch (erro) {
    await conexao.query('ROLLBACK')
    throw erro
  } finally { conexao.release() }
}
