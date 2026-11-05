import Constants from 'expo-constants'

const hostExpo = Constants.expoConfig?.hostUri?.split(':')[0]
let baseUrl = process.env.EXPO_PUBLIC_API_URL || `http://${hostExpo || '127.0.0.1'}:3001`
let tokenAtual = null
let aoExpirar = () => {}

export function configurarApi(url, token, expirar) {
  if (url) baseUrl = url.replace(/\/$/, '')
  tokenAtual = token || null
  if (expirar) aoExpirar = expirar
}
export const enderecoApi = () => baseUrl

export async function api(caminho, { method = 'GET', body, signal } = {}) {
  const controle = new AbortController()
  const cancelar = () => controle.abort()
  if (signal?.aborted) cancelar()
  signal?.addEventListener('abort', cancelar, { once: true })
  const timeout = setTimeout(cancelar, 70000)
  try {
    const resposta = await fetch(`${baseUrl}/v1${caminho}`, {
      method, signal: controle.signal,
      headers: { 'Content-Type': 'application/json', ...(tokenAtual ? { Authorization: `Bearer ${tokenAtual}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const dados = resposta.status === 204 ? null : await resposta.json()
    if (!resposta.ok) {
      if (resposta.status === 401 && tokenAtual && !caminho.startsWith('/auth/')) aoExpirar()
      const erro = new Error(dados?.erro || 'Não foi possível concluir a solicitação.')
      erro.status = resposta.status
      throw erro
    }
    return dados
  } catch (erro) {
    if (erro.status || signal?.aborted) throw erro
    throw new Error('Não foi possível conectar à API. Confira o endereço do computador e a rede Wi-Fi.')
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancelar) }
}
