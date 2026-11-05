import { configuracao } from '../config.js'

export async function analisarFotos(fotos) {
  if (!configuracao.segredoIntegracao) throw Object.assign(new Error('Prepare a integração facial no computador antes de cadastrar funcionários.'), { status: 503 })
  const arquivos = fotos.map((foto) => Buffer.from(foto.replace(/^data:image\/[^;]+;base64,/, ''), 'base64'))
  if (arquivos.some((foto) => foto.length < 10 || foto.length > 5 * 1024 * 1024)) throw Object.assign(new Error('Cada foto deve ser JPG/PNG de até 5 MB.'), { status: 422 })
  const form = new FormData()
  arquivos.forEach((foto, i) => form.append('fotos', new Blob([foto]), `foto${i}.jpg`))
  let resposta
  try {
    resposta = await fetch(`${configuracao.facial}/integracao/analisar-fotos`, { method: 'POST', headers: { 'X-Integration-Key': configuracao.segredoIntegracao }, body: form, signal: AbortSignal.timeout(60000) })
  } catch { throw Object.assign(new Error('O reconhecimento facial está indisponível. Inicie a API Python no computador.'), { status: 503 }) }
  const resultado = await resposta.json().catch(() => ({}))
  if (!resposta.ok) throw Object.assign(new Error(typeof resultado.detail === 'string' ? resultado.detail : 'Não foi possível validar as fotos.'), { status: resposta.status === 422 ? 422 : 503 })
  return resultado.fotos.map((foto, i) => ({ ...foto, conteudo: arquivos[i] }))
}
