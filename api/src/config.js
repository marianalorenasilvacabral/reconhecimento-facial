import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

export const raiz = fileURLToPath(new URL('../../', import.meta.url))
dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true })
dotenv.config({ path: new URL('../../.env', import.meta.url), quiet: true })

export const configuracao = {
  porta: Number(process.env.PORT || 3001),
  host: process.env.HOST || '0.0.0.0',
  banco: (process.env.DATABASE_URL || '').replace('postgresql+psycopg://', 'postgresql://'),
  facial: process.env.FACIAL_API_URL || 'http://127.0.0.1:8000',
  segredoIntegracao: process.env.MOBILE_INTEGRATION_SECRET || '',
}
