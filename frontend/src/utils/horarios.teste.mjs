import assert from 'node:assert/strict'
import { formatarDuracao, formatarHorario } from './horarios.js'

assert.equal(formatarDuracao(9008), '02:30:08')
assert.equal(formatarDuracao(26 * 3600), '26:00:00')
assert.equal(formatarDuracao(-10), '00:00:00')
assert.equal(formatarHorario(null), '—')
assert.match(formatarHorario('2026-10-27T02:30:00Z'), /26\/10\/2026/)
assert.match(formatarHorario('2026-10-27T02:30:00Z'), /23:30:00/)
console.log('horarios.js: todos os testes passaram')
