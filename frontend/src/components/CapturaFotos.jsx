import { useEffect, useRef, useState } from 'react'
import {
  TOTAL_FOTOS,
  ROTULOS_FOTOS,
  TIPOS_ACEITOS,
  TAMANHO_MAX_MB,
} from '../utils/validacao.js'

/**
 * Captura de 5 fotos (câmera ou arquivos), com prévia e opção de refazer cada uma.
 * `fotos` é um array de TOTAL_FOTOS posições: null ou { blob, url }.
 */
export default function CapturaFotos({ fotos, onChange, erro }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const arquivoRef = useRef(null)
  const [cameraAtiva, setCameraAtiva] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const [aviso, setAviso] = useState('')

  const preenchidas = fotos.filter(Boolean).length

  useEffect(() => {
    if (cameraAtiva && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraAtiva])

  useEffect(() => () => pararStream(), [])

  function pararStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function ligarCamera() {
    setAviso('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setAviso('Este navegador não permite usar a câmera. Envie as fotos como arquivos.')
      return
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      setCameraAtiva(true)
    } catch {
      setAviso('Não foi possível acessar a câmera. Verifique a permissão do navegador ou envie arquivos.')
    }
  }

  function desligarCamera() {
    pararStream()
    setCameraAtiva(false)
  }

  function proximoVazio(lista, padrao) {
    const i = lista.findIndex((f) => !f)
    return i === -1 ? padrao : i
  }

  function definirFoto(indice, blob) {
    const novas = [...fotos]
    if (novas[indice]) URL.revokeObjectURL(novas[indice].url)
    novas[indice] = { blob, url: URL.createObjectURL(blob) }
    onChange(novas)
    setAtivo(proximoVazio(novas, indice))
  }

  function capturar() {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setAviso('A câmera ainda está iniciando. Aguarde um instante.')
      return
    }
    setAviso('')
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => blob && definirFoto(ativo, blob), 'image/jpeg', 0.92)
  }

  function refazer(indice) {
    const novas = [...fotos]
    if (novas[indice]) URL.revokeObjectURL(novas[indice].url)
    novas[indice] = null
    onChange(novas)
    setAtivo(indice)
    setAviso('')
  }

  function aoEscolherArquivos(evento) {
    const arquivos = Array.from(evento.target.files ?? [])
    evento.target.value = ''
    if (!arquivos.length) return

    const problemas = []
    const validos = arquivos.filter((a) => {
      if (!TIPOS_ACEITOS.includes(a.type)) {
        problemas.push(`${a.name}: formato não aceito (use JPG ou PNG)`)
        return false
      }
      if (a.size > TAMANHO_MAX_MB * 1024 * 1024) {
        problemas.push(`${a.name}: maior que ${TAMANHO_MAX_MB} MB`)
        return false
      }
      return true
    })

    const novas = [...fotos]
    const usados = new Set()
    validos.forEach((arquivo, i) => {
      const alvo = i === 0 ? ativo : fotos.findIndex((f, j) => !f && !usados.has(j))
      if (alvo === -1) {
        problemas.push(`${arquivo.name}: sem espaço livre (use "Refazer" para substituir uma foto)`)
        return
      }
      usados.add(alvo)
      if (novas[alvo]) URL.revokeObjectURL(novas[alvo].url)
      novas[alvo] = { blob: arquivo, url: URL.createObjectURL(arquivo) }
    })

    if (usados.size) {
      onChange(novas)
      setAtivo(proximoVazio(novas, ativo))
    }
    setAviso(problemas.join(' · '))
  }

  return (
    <section className="capturas" aria-labelledby="titulo-fotos">
      <div className="capturas-cabecalho">
        <h3 id="titulo-fotos">Fotos do rosto</h3>
        <span className={`contador ${preenchidas === TOTAL_FOTOS ? 'completo' : ''}`}>
          {preenchidas} de {TOTAL_FOTOS}
        </span>
      </div>
      <p className="ajuda">
        Rosto bem iluminado, sem boné ou máscara. Selecione uma vaga abaixo e capture com a câmera ou
        envie arquivos JPG/PNG (até {TAMANHO_MAX_MB} MB cada).
      </p>

      <div className="camera-area">
        {cameraAtiva ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="video" />
            <div className="acoes-linha">
              <button type="button" className="btn primario" onClick={capturar}>
                Capturar foto {ativo + 1} · {ROTULOS_FOTOS[ativo]}
              </button>
              <button type="button" className="btn secundario" onClick={desligarCamera}>
                Desligar câmera
              </button>
            </div>
          </>
        ) : (
          <div className="acoes-linha">
            <button type="button" className="btn primario" onClick={ligarCamera}>
              Ligar câmera
            </button>
            <button type="button" className="btn secundario" onClick={() => arquivoRef.current?.click()}>
              Enviar arquivos
            </button>
          </div>
        )}
        {cameraAtiva && (
          <button type="button" className="btn texto" onClick={() => arquivoRef.current?.click()}>
            ou enviar arquivos
          </button>
        )}
        <input
          ref={arquivoRef}
          type="file"
          accept={TIPOS_ACEITOS.join(',')}
          multiple
          hidden
          onChange={aoEscolherArquivos}
        />
      </div>

      {aviso && (
        <p className="alerta aviso" role="status">
          {aviso}
        </p>
      )}

      <ul className="vagas">
        {fotos.map((foto, i) => (
          <li key={i} className={`vaga ${i === ativo ? 'selecionada' : ''} ${foto ? 'cheia' : ''}`}>
            <button
              type="button"
              className="vaga-corpo"
              onClick={() => setAtivo(i)}
              aria-pressed={i === ativo}
              aria-label={`Foto ${i + 1}: ${ROTULOS_FOTOS[i]}${foto ? ' (capturada)' : ' (vazia)'}`}
            >
              {foto ? (
                <img src={foto.url} alt={`Prévia da foto ${i + 1}`} />
              ) : (
                <span className="vaga-numero">{i + 1}</span>
              )}
            </button>
            <span className="vaga-rotulo">{ROTULOS_FOTOS[i]}</span>
            {foto && (
              <button type="button" className="btn texto pequeno" onClick={() => refazer(i)}>
                Refazer
              </button>
            )}
          </li>
        ))}
      </ul>

      {erro && (
        <p className="erro-campo" role="alert">
          {erro}
        </p>
      )}
    </section>
  )
}
