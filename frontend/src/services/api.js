import { apenasDigitos } from '../utils/validacao.js'

const URL_CONFIGURADA = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
// Mantém cookies no mesmo site ao abrir a interface por localhost ou 127.0.0.1.
const BASE_URL = (() => {
  if (!/^https?:/.test(URL_CONFIGURADA)) return URL_CONFIGURADA
  const url = new URL(URL_CONFIGURADA)
  const locais = ['localhost', '127.0.0.1', '[::1]']
  if (locais.includes(url.hostname) && locais.includes(window.location.hostname)) url.hostname = window.location.hostname
  return url.toString().replace(/\/$/, '')
})()
const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === 'true'

export const MODO_DEMO_ATIVO = MODO_DEMO

export class ErroApi extends Error {
  constructor(mensagem, { status } = {}) {
    super(mensagem)
    this.name = 'ErroApi'
    this.status = status
  }
}

async function chamar(caminho, opcoes) {
  const controle = new AbortController()
  const abortar = () => controle.abort()
  const sinalExterno = opcoes?.signal
  if (sinalExterno?.aborted) abortar()
  sinalExterno?.addEventListener('abort', abortar, { once: true })
  const temporizador = setTimeout(abortar, 15000)
  try {
    return await fetch(`${BASE_URL}${caminho}`, { credentials: 'include', ...opcoes, signal: controle.signal })
  } catch (erro) {
    if (sinalExterno?.aborted) throw erro
    if (controle.signal.aborted) throw new ErroApi('O servidor demorou a responder. Tentando novamente…')
    throw new ErroApi('Não foi possível conectar ao servidor. Verifique se a API está em execução.')
  } finally {
    clearTimeout(temporizador)
    sinalExterno?.removeEventListener('abort', abortar)
  }
}

async function detalheDoErro(resposta) {
  try {
    const { detail } = await resposta.json()
    return typeof detail === 'string' ? detail : null
  } catch {
    return null
  }
}

/**
 * Envia o cadastro para POST /alunos (multipart/form-data).
 * Campos: nome, data_nascimento (AAAA-MM-DD), cpf (somente dígitos), consentimento e 5 arquivos "fotos".
 * Em modo demonstração, apenas simula a resposta e NADA é salvo.
 */
export async function cadastrarAluno({ nome, nascimento, cpf }, fotos) {
  if (MODO_DEMO) {
    await new Promise((resolve) => setTimeout(resolve, 900))
    return { matricula: `DEMO-${Date.now().toString().slice(-6)}`, demo: true }
  }

  const form = new FormData()
  form.append('nome', nome.trim().replace(/\s+/g, ' '))
  form.append('data_nascimento', nascimento)
  form.append('cpf', apenasDigitos(cpf))
  // A tela só chega aqui depois que a caixa de autorização foi marcada.
  form.append('consentimento', 'true')
  fotos.forEach((foto, i) => {
    const extensao = foto.blob.type === 'image/png' ? 'png' : 'jpg'
    form.append('fotos', foto.blob, `foto_${i + 1}.${extensao}`)
  })

  const resposta = await chamar('/alunos', { method: 'POST', body: form })
  if (!resposta.ok) {
    const detalhe = await detalheDoErro(resposta)
    const mensagem =
      resposta.status === 409
        ? 'Já existe um cadastro com este CPF.'
        : (detalhe ?? 'Não foi possível salvar o cadastro.')
    throw new ErroApi(mensagem, { status: resposta.status })
  }
  return resposta.json()
}

/** GET /alunos?nome= : lista os alunos (CPF já vem mascarado pela API). */
export async function listarAlunos(nome = '') {
  const consulta = new URLSearchParams({ nome: nome.trim(), limite: '200' })
  const resposta = await chamar(`/alunos?${consulta}`)
  if (!resposta.ok) throw new ErroApi('Não foi possível carregar a lista de alunos.', { status: resposta.status })
  return resposta.json()
}

/** GET /alunos/{id} : dados do aluno e quantidade de fotos. */
export async function obterAluno(id) {
  const resposta = await chamar(`/alunos/${id}`)
  if (!resposta.ok) throw new ErroApi('Não foi possível carregar o aluno.', { status: resposta.status })
  return resposta.json()
}

/** Endereço da imagem (posição 1 a 5), para usar em <img src>. */
export const urlFoto = (id, posicao) => `${BASE_URL}/alunos/${id}/fotos/${posicao}`

// ------------------------------------------------------------ identificação e modo celular

/** POST /identificacoes : envia UM quadro (Blob JPEG) e recebe status + (se identificado) o cartão. */
export async function identificarQuadro(blob, sinal) {
  const form = new FormData()
  form.append('imagem', blob, 'quadro.jpg')
  const resposta = await chamar('/identificacoes', { method: 'POST', body: form, signal: sinal })
  if (!resposta.ok) {
    const detalhe = await detalheDoErro(resposta)
    throw new ErroApi(detalhe ?? 'Não foi possível identificar o quadro.', { status: resposta.status })
  }
  return resposta.json()
}

/** POST /celular/sessoes : cria a sessão do celular e devolve o token secreto. */
export async function criarSessaoCelular() {
  const resposta = await chamar('/celular/sessoes', { method: 'POST' })
  if (!resposta.ok) throw new ErroApi('Não foi possível iniciar o modo celular.', { status: resposta.status })
  return (await resposta.json()).token
}

export async function encerrarSessaoCelular(token) {
  try {
    await fetch(`${BASE_URL}/celular/sessoes/${token}`, { method: 'DELETE', keepalive: true })
  } catch {
    /* a sessão expira sozinha depois de 15 minutos sem uso */
  }
}

/** GET /celular/conexao : endereços deste computador na rede (para montar o link do celular). */
export async function enderecosDaRede() {
  const resposta = await chamar('/celular/conexao')
  if (!resposta.ok) return []
  return (await resposta.json()).enderecos ?? []
}

/** GET /celular/{token}/ultimo : { conectado, quadro, idade_ms, resultado } */
export async function ultimoDoCelular(token, sinal) {
  const resposta = await chamar(`/celular/${token}/ultimo`, { signal: sinal })
  if (resposta.status === 404) throw new ErroApi('A sessão do celular expirou.', { status: 404 })
  if (!resposta.ok) throw new ErroApi('Não foi possível consultar o celular.', { status: resposta.status })
  return resposta.json()
}

export const urlImagemCelular = (token, quadro) => `${BASE_URL}/celular/${token}/imagem?q=${quadro}`

/** Usado pela página do CELULAR: envia um quadro e recebe só o estado (sem dados pessoais). */
export async function enviarQuadroDoCelular(token, blob, sinal) {
  const form = new FormData()
  form.append('imagem', blob, 'quadro.jpg')
  const resposta = await chamar(`/celular/${token}/quadro`, { method: 'POST', body: form, signal: sinal })
  if (resposta.status === 404) throw new ErroApi('A sessão terminou. Gere um novo QR code no computador.', { status: 404 })
  if (!resposta.ok) throw new ErroApi('Falha ao enviar o quadro.', { status: resposta.status })
  return resposta.json()
}

async function chamarAdmin(caminho, opcoes) {
  const resposta = await chamar(`/admin${caminho}`, opcoes)
  if (!resposta.ok) throw new ErroApi((await detalheDoErro(resposta)) ?? 'Não foi possível acessar os horários.', { status: resposta.status })
  return resposta.status === 204 ? null : resposta.json()
}

export const estadoAdmin = () => chamarAdmin('/estado')
export const autenticarAdmin = (usuario, senha, configurar = false) => chamarAdmin(configurar ? '/configurar' : '/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario, senha }),
})
export const sairAdmin = () => chamarAdmin('/logout', { method: 'POST' })
export async function excluirAluno(id) {
  const resposta = await chamar(`/admin/alunos/${id}`, { method: 'DELETE' })
  if (!resposta.ok) throw new ErroApi((await detalheDoErro(resposta)) ?? 'Não foi possível excluir o cadastro.', { status: resposta.status })
}
export const listarPontos = (filtros, signal) => {
  const consulta = new URLSearchParams(Object.entries(filtros).filter(([, valor]) => valor !== '' && valor != null))
  return chamarAdmin(`/pontos?${consulta}`, { signal })
}
