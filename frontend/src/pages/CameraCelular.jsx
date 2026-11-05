import { useEffect, useRef, useState } from 'react'
import { enviarQuadroDoCelular } from '../services/api.js'
import { INTERVALO_MS, capturarQuadro, manterTelaLigada, mensagemDeErroDeCamera } from '../utils/camera.js'

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const TEXTO_ESTADO = {
  identificado: 'Rosto reconhecido',
  nao_identificado: 'Rosto não reconhecido',
  revisao_necessaria: 'Ajuste a posição e aproxime-se',
  sem_rosto: 'Procurando rosto…',
}

/**
 * Página aberta NO CELULAR (via QR code). Usa a câmera do aparelho e envia um quadro por vez ao
 * computador. O celular nunca recebe dados de alunos: só o estado do quadro.
 */
export default function CameraCelular({ token }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [frente, setFrente] = useState(true)
  const [iniciada, setIniciada] = useState(false)
  const [pronta, setPronta] = useState(false)
  const [erro, setErro] = useState(null)
  const [estado, setEstado] = useState(null)
  const [encerrada, setEncerrada] = useState(false)

  useEffect(() => {
    if (!iniciada) return undefined
    let cancelado = false
    let fluxo = null
    let soltarTela = () => {}
    setPronta(false)
    setErro(null)
    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro(mensagemDeErroDeCamera(null))
        return
      }
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: frente ? 'user' : 'environment', width: { ideal: 1280 } },
          audio: false,
        })
        if (cancelado) {
          fluxo.getTracks().forEach((t) => t.stop())
          return
        }
        videoRef.current.srcObject = fluxo
        await videoRef.current.play().catch(() => {})
        if (cancelado) return
        const soltar = await manterTelaLigada()
        if (cancelado) {
          soltar()
          return
        }
        soltarTela = soltar
        setPronta(true)
      } catch (e) {
        if (!cancelado) setErro(mensagemDeErroDeCamera(e))
      }
    })()
    return () => {
      cancelado = true
      soltarTela()
      fluxo?.getTracks().forEach((t) => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [iniciada, frente])

  useEffect(() => {
    if (!pronta) return undefined
    let parar = false
    const controle = new AbortController()
    ;(async () => {
      while (!parar) {
        const inicio = performance.now()
        try {
          const quadro = await capturarQuadro(videoRef.current, canvasRef.current)
          if (quadro && !parar) {
            const { status } = await enviarQuadroDoCelular(token, quadro, controle.signal)
            if (!parar) {
              setEstado(status)
              setErro(null)
            }
          }
        } catch (e) {
          if (parar) return
          if (e.status === 404) {
            setEncerrada(true)
            setErro(e.message)
            setIniciada(false)
            setEstado(null)
            return
          }
          setErro('Sem conexão com o computador. Tentando de novo…')
        }
        await esperar(Math.max(0, INTERVALO_MS - (performance.now() - inicio)))
      }
    })()
    return () => {
      parar = true
      controle.abort()
    }
  }, [pronta, token])

  const seguro = window.isSecureContext

  return (
    <div className="celular">
      <h1>Câmera do celular</h1>
      {!seguro && (
        <p className="alerta erro" role="alert">
          Esta página precisa ser aberta por <strong>https</strong> para usar a câmera. Use o QR code gerado
          pelo computador.
        </p>
      )}
      <div className="camera-area">
        <video ref={videoRef} className={`camera-video ${frente ? 'espelhado' : ''}`} playsInline muted />
        {!iniciada && <div className="camera-sobre">Toque em “Iniciar” para ligar a câmera.</div>}
      </div>
      {erro && <p className="alerta erro" role="alert">{erro}</p>}
      {iniciada && pronta && !erro && <p className="faixa-estado neutro" aria-live="polite">{TEXTO_ESTADO[estado] ?? 'Enviando imagens…'}</p>}
      <canvas ref={canvasRef} hidden />
      <div className="barra-camera">
        {!iniciada ? (
          <button type="button" className="botao" disabled={!seguro || encerrada} onClick={() => setIniciada(true)}>
            Iniciar
          </button>
        ) : (
          <>
            <button type="button" className="botao secundario" onClick={() => setFrente((f) => !f)}>
              Virar câmera
            </button>
            <button type="button" className="botao secundario" onClick={() => { setIniciada(false); setEstado(null) }}>
              Parar
            </button>
          </>
        )}
      </div>
      <p className="ajuda">
        As imagens vão apenas para o computador que gerou o QR code e ficam só na memória dele. Para
        encerrar, toque em “Parar” ou feche esta página.
      </p>
    </div>
  )
}
