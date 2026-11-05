/** Utilidades de câmera compartilhadas pela tela do computador e pela página do celular. */

export const LARGURA_QUADRO = 640
export const INTERVALO_MS = 700

export function lembrar(chave, valor) {
  try {
    if (valor == null) localStorage.removeItem(chave)
    else localStorage.setItem(chave, valor)
  } catch {
    /* armazenamento indisponível: segue sem lembrar */
  }
}

export function recordar(chave) {
  try {
    return localStorage.getItem(chave)
  } catch {
    return null
  }
}

export function mensagemDeErroDeCamera(erro) {
  if (!window.isSecureContext) {
    return 'O navegador só libera a câmera em páginas seguras (https ou localhost).'
  }
  switch (erro?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Permissão da câmera negada. Libere o acesso nas configurações do navegador.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Nenhuma câmera encontrada com essas configurações.'
    case 'NotReadableError':
      return 'A câmera está em uso por outro programa. Feche-o e tente de novo.'
    default:
      return 'Não foi possível abrir a câmera.'
  }
}

/** Copia o quadro atual do <video> para um JPEG de até LARGURA_QUADRO pixels de largura. */
export function capturarQuadro(video, canvas) {
  if (!video.videoWidth || !video.videoHeight) return Promise.resolve(null)
  const escala = Math.min(1, LARGURA_QUADRO / video.videoWidth)
  canvas.width = Math.round(video.videoWidth * escala)
  canvas.height = Math.round(video.videoHeight * escala)
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
}

/** Pede a tela ligada enquanto a câmera estiver em uso (quando o navegador permite). */
export async function manterTelaLigada() {
  try {
    const trava = await navigator.wakeLock?.request('screen')
    return () => trava?.release().catch(() => {})
  } catch {
    return () => {}
  }
}
