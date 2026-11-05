import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { pool, transacao } from './pool.js'

export async function migrar(banco = pool) {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8')
  await transacao(banco, async (conexao) => {
    await conexao.query('SELECT pg_advisory_xact_lock(78392012)')
    await conexao.query(sql)
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await migrar(); console.log('Tabelas empresariais preparadas.') }
  catch { console.error('Não foi possível preparar as tabelas. Confira DATABASE_URL e as tabelas do reconhecimento facial.'); process.exitCode = 1 }
  finally { await pool.end() }
}
