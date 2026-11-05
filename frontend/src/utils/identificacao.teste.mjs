import assert from 'node:assert/strict'
import { ESTADO_INICIAL, proximoEstado } from './identificacao.js'

const joao = { id: 1, nome: 'João' }
const maria = { id: 2, nome: 'Maria' }
const ok = (aluno) => ({ status: 'identificado', rostos: 1, aluno })
const rodar = (...resultados) => resultados.reduce(proximoEstado, ESTADO_INICIAL)

assert.equal(rodar(ok(joao)).aluno, null)
assert.equal(rodar(ok(joao), ok(joao)).aluno.id, 1)
assert.equal(rodar(ok(joao), ok(joao), ok(joao)).aluno.id, 1)

// Cada perda de confiança remove o cartão e exige duas novas confirmações.
for (const resultado of [
  { status: 'sem_rosto', rostos: 0 },
  { status: 'nao_identificado', rostos: 1 },
  { status: 'revisao_necessaria', rostos: 2, motivo: 'Há mais de um rosto' },
  { status: 'revisao_necessaria', rostos: 1, motivo: 'Correspondência incerta' },
  { status: 'identificado', rostos: 2, aluno: joao },
  { status: 'identificado', rostos: 1 },
  { status: 'inesperado' },
  null,
]) {
  assert.equal(rodar(ok(joao), ok(joao), resultado).aluno, null)
  assert.equal(rodar(ok(joao), ok(joao), resultado, ok(joao)).aluno, null)
  assert.equal(rodar(ok(joao), ok(joao), resultado, ok(joao), ok(joao)).aluno.id, 1)
}

// O primeiro quadro de outra pessoa esconde o cartão anterior imediatamente.
assert.equal(rodar(ok(joao), ok(joao), ok(maria)).aluno, null)
assert.equal(rodar(ok(joao), ok(joao), ok(maria), ok(maria)).aluno.id, 2)
assert.equal(rodar(ok(joao), ok(maria), ok(joao)).aluno, null)
assert.equal(rodar({ status: 'revisao_necessaria' }).mensagem, 'Identificação não confirmada')
console.log('identificacao.js: todos os testes passaram')
