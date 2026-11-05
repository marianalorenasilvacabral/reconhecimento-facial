import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import CartaoAluno from '../components/CartaoAluno.jsx'
import QrCode from '../components/QrCode.jsx'
import {
  criarSessaoCelular,
  encerrarSessaoCelular,
  enderecosDaRede,
  identificarQuadro,
  ultimoDoCelular,
  urlImagemCelular,
} from '../services/api.js'
import { ESTADO_INICIAL, TEMPO_SEM_RESULTADO_MS, proximoEstado } from '../utils/identificacao.js'
import {
  INTERVALO_MS,
  capturarQuadro,
  lembrar,
  mensagemDeErroDeCamera,
  recordar,
} from '../utils/camera.js'

const PORTA_CELULAR = 5174
const reducer = (estado, acao) => (acao === 'zerar' ? ESTADO_INICIAL : proximoEstado(estado, acao))
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------- câmera do computador
// Inclui as "webcams virtuais" de apps que transformam o celular em câmera (DroidCam, Iriun,
// Câmera conectada do Windows...): elas aparecem na lista como qualquer outra câmera.

function CameraDoComputador({ aoResultado, aoZerar, aoParar }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [dispositivos, setDispositivos] = useState([])
  const [deviceId, setDeviceId] = useState(() => recordar('camera_id') ?? '')
  const [pronta, setPronta] = useState(false)
  const [erro, setErro] = useState(null)
  const [erroApi, setErroApi] = useState(null)

  // abre a câmera escolhida
  useEffect(() => {
    let cancelado = false
    let fluxo = null
    setPronta(false)
    setErro(null)
    aoZerar()

    async function abrir() {
      // Deixa a limpeza anterior terminar antes de solicitar outro fluxo.
      // No StrictMode, o primeiro efeito pode ser cancelado antes desta espera acabar.
      await esperar(150)
      if (cancelado) return
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro(mensagemDeErroDeCamera(null))
        return
      }
      try {
        const video = deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 } }
          : { facingMode: 'user', width: { ideal: 1280 } }
        fluxo = await navigator.mediaDevices.getUserMedia({ video, audio: false })
        if (cancelado) {
          fluxo.getTracks().forEach((t) => t.stop())
          return
        }
        const el = videoRef.current
        el.srcObject = fluxo
        await el.play().catch(() => {})
        if (cancelado) return
        fluxo.getVideoTracks().forEach((track) => track.addEventListener('ended', () => {
          if (!cancelado) {
            setPronta(false)
            setErro('A câmera foi desconectada. Escolha outra câmera ou tente novamente.')
            aoZerar()
          }
        }))
        setPronta(true)
        // os nomes das câmeras só aparecem depois da permissão
        const lista = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
        if (!cancelado) setDispositivos(lista)
      } catch (e) {
        if (!cancelado) {
          if (deviceId && (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError')) {
            lembrar('camera_id', null) // a câmera salva não existe mais
            setDeviceId('')
          } else {
            setErro(mensagemDeErroDeCamera(e))
          }
        }
      }
    }
    abrir()
    return () => {
      cancelado = true
      fluxo?.getTracks().forEach((t) => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [deviceId, aoZerar])

  // envia um quadro por vez, sem acumular pedidos
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
            const resultado = await identificarQuadro(quadro, controle.signal)
            if (!parar) {
              aoResultado(resultado)
              setErroApi(null)
            }
          } else if (!parar) {
            aoZerar()
          }
        } catch (e) {
          if (parar) return
          aoZerar()
          setErroApi(e.message)
        }
        await esperar(Math.max(0, INTERVALO_MS - (performance.now() - inicio)))
      }
    })()
    return () => {
      parar = true
      controle.abort()
    }
  }, [pronta, aoResultado, aoZerar])

  const escolher = (id) => {
    setDeviceId(id)
    lembrar('camera_id', id || null)
  }

  return (
    <>
      <div className="camera-area">
        <video ref={videoRef} className="camera-video" playsInline muted />
        {!pronta && !erro && <div className="camera-sobre">Abrindo a câmera…</div>}
        {erro && <div className="camera-sobre erro">{erro}</div>}
        <canvas ref={canvasRef} hidden />
      </div>
      {erroApi && <p className="alerta erro" role="alert">{erroApi}</p>}
      <div className="barra-camera">
        <label className="campo-inline">
          Câmera
          <select value={deviceId} onChange={(e) => escolher(e.target.value)}>
            <option value="">Padrão do navegador</option>
            {dispositivos.map((d, i) => (
              <option key={d.deviceId || i} value={d.deviceId}>
                {d.label || `Câmera ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="botao secundario" onClick={aoParar}>
          Desligar câmera
        </button>
      </div>
      <p className="ajuda">
        Dica: apps como DroidCam ou Iriun, e a “Câmera conectada” do Windows, fazem o celular aparecer
        nesta lista como uma webcam comum.
      </p>
    </>
  )
}

// ---------------------------------------------------------------- celular pelo navegador

function CameraDoCelular({ aoResultado, aoZerar, aoParar }) {
  const [token, setToken] = useState(null)
  const [enderecos, setEnderecos] = useState([])
  const [ip, setIp] = useState('')
  const [erro, setErro] = useState(null)
  const [tentativa, setTentativa] = useState(0)
  const [painel, setPainel] = useState({ conectado: false, quadro: 0 })

  // cria a sessão ao entrar e a encerra ao sair
  useEffect(() => {
    let cancelado = false
    let criado = null
    setErro(null)
    setToken(null)
    setPainel({ conectado: false, quadro: 0 })
    aoZerar()
    ;(async () => {
      try {
        const [novo, lista] = await Promise.all([criarSessaoCelular(), enderecosDaRede()])
        if (cancelado) {
          encerrarSessaoCelular(novo)
          return
        }
        criado = novo
        setToken(novo)
        setEnderecos(lista)
        setIp((atual) => atual || recordar('ip_do_computador') || lista[0] || '')
      } catch (e) {
        if (!cancelado) setErro(e.message)
      }
    })()
    return () => {
      cancelado = true
      if (criado) encerrarSessaoCelular(criado)
    }
  }, [tentativa, aoZerar])

  // consulta o que o celular está vendo
  useEffect(() => {
    if (!token) return undefined
    let parar = false
    const controle = new AbortController()
    let ultimoQuadro = 0
    ;(async () => {
      while (!parar) {
        try {
          const info = await ultimoDoCelular(token, controle.signal)
          if (parar) return
          setPainel({ conectado: info.conectado, quadro: info.quadro })
          if (info.conectado && info.quadro !== ultimoQuadro && info.resultado) {
            ultimoQuadro = info.quadro
            aoResultado(info.resultado)
          }
          if (!info.conectado) aoZerar()
          setErro(null)
        } catch (e) {
          if (parar) return
          aoZerar()
          setPainel({ conectado: false, quadro: 0 })
          setErro(e.message)
          if (e.status === 404) return
        }
        await esperar(INTERVALO_MS)
      }
    })()
    return () => {
      parar = true
      controle.abort()
    }
  }, [token, aoResultado, aoZerar])

  const ipLimpo = ip.trim()
  const link = token && ipLimpo ? `https://${ipLimpo}:${PORTA_CELULAR}/#celular/${token}` : ''

  return (
    <>
      <div className="camera-area">
        {painel.conectado && painel.quadro > 0 ? (
          <img className="camera-video" src={urlImagemCelular(token, painel.quadro)} alt="Imagem enviada pelo celular" />
        ) : (
          <div className="camera-sobre">
            {token ? 'Aguardando o celular enviar imagens…' : 'Preparando o modo celular…'}
          </div>
        )}
      </div>
      {erro && <p className="alerta erro" role="alert">{erro}</p>}

      <div className="painel-celular">
        <div>{link && <QrCode texto={link} />}</div>
        <div className="passos-celular">
          <p className={painel.conectado ? 'status-celular on' : 'status-celular'}>
            {painel.conectado ? '● Celular conectado' : '○ Celular não conectado'}
          </p>
          <ol>
            <li>Conecte o celular na <strong>mesma rede Wi-Fi</strong> deste computador.</li>
            <li>Aponte a câmera do celular para o QR code (ou digite o link).</li>
            <li>O navegador avisará que o certificado não é de confiança: é esperado (certificado local). Escolha “Avançado” e continue.</li>
            <li>Permita o uso da câmera e toque em “Iniciar”.</li>
          </ol>
          <label className="campo-inline">
            Endereço (IP) deste computador
            <input
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              onBlur={() => lembrar('ip_do_computador', ipLimpo || null)}
              list="ips-do-computador"
              inputMode="decimal"
              placeholder="192.168.0.10"
            />
            <datalist id="ips-do-computador">
              {enderecos.map((e) => <option key={e} value={e} />)}
            </datalist>
          </label>
          {link && <p className="ajuda link-celular">{link}</p>}
          {!enderecos.length && token && (
            <p className="ajuda">Não encontrei o IP automaticamente. No Windows, rode <code>ipconfig</code> e use o “Endereço IPv4”.</p>
          )}
          <div className="barra-camera">
            <button type="button" className="botao secundario" onClick={() => setTentativa((n) => n + 1)}>
              Gerar novo QR code
            </button>
            <button type="button" className="botao secundario" onClick={aoParar}>
              Encerrar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- tela

export default function Identificacao() {
  const [fonte, setFonte] = useState(null) // null | 'webcam' | 'celular'
  const [estado, dispatch] = useReducer(reducer, ESTADO_INICIAL)

  const ultimoResultado = useRef(0)
  const aoResultado = useCallback((resultado) => {
    if (document.hidden) return
    ultimoResultado.current = Date.now()
    dispatch(resultado)
  }, [])
  const aoZerar = useCallback(() => dispatch('zerar'), [])
  useEffect(() => {
    const limpar = () => {
      ultimoResultado.current = 0
      aoZerar()
    }
    const temporizador = setInterval(() => {
      if (ultimoResultado.current && Date.now() - ultimoResultado.current > TEMPO_SEM_RESULTADO_MS) limpar()
    }, 250)
    document.addEventListener('visibilitychange', limpar)
    return () => {
      clearInterval(temporizador)
      document.removeEventListener('visibilitychange', limpar)
    }
  }, [aoZerar])
  const escolher = (nova) => {
    dispatch('zerar')
    setFonte(nova)
  }

  return (
    <>
      <h1>Identificação pela câmera</h1>
      <p className="ajuda">
        Compara o rosto diante da câmera com as fotos cadastradas. Em caso de dúvida, nenhum dado é exibido.
      </p>
      <p className="ajuda">A primeira passagem registra a entrada; a próxima registra a saída. Para marcar novamente, fique pelo menos cinco segundos fora da câmera e volte.</p>

      <div className="abas-fonte" role="group" aria-label="Origem da câmera">
        <button type="button" className={fonte === 'webcam' ? 'botao' : 'botao secundario'} onClick={() => escolher('webcam')}>
          Câmera do computador
        </button>
        <button type="button" className={fonte === 'celular' ? 'botao' : 'botao secundario'} onClick={() => escolher('celular')}>
          Usar o celular como câmera
        </button>
      </div>

      <div className="duas-colunas">
        <section aria-label="Câmera">
          {fonte === 'webcam' && <CameraDoComputador aoResultado={aoResultado} aoZerar={aoZerar} aoParar={() => escolher(null)} />}
          {fonte === 'celular' && (
            <CameraDoCelular aoResultado={aoResultado} aoZerar={aoZerar} aoParar={() => escolher(null)} />
          )}
          {fonte === null && <div className="camera-placeholder">Câmera desligada. Escolha uma origem acima.</div>}
          {fonte && <p className={`faixa-estado ${estado.tom}`} aria-live="polite">{estado.mensagem}</p>}
        </section>
        <CartaoAluno aluno={estado.aluno} />
      </div>
    </>
  )
}
