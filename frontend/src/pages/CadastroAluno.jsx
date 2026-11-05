import { useEffect, useRef, useState } from 'react'
import CapturaFotos from '../components/CapturaFotos.jsx'
import { cadastrarAluno } from '../services/api.js'
import {
  TOTAL_FOTOS,
  formatarCpf,
  formatarData,
  hojeIso,
  mascararCpf,
  validarDados,
  validarFotos,
} from '../utils/validacao.js'

const DADOS_VAZIOS = { nome: '', nascimento: '', cpf: '' }
const fotosVazias = () => Array(TOTAL_FOTOS).fill(null)

export default function CadastroAluno() {
  const [etapa, setEtapa] = useState('formulario') // formulario | revisao | sucesso
  const [dados, setDados] = useState(DADOS_VAZIOS)
  const [fotos, setFotos] = useState(fotosVazias)
  const [consentimento, setConsentimento] = useState(false)
  const [erros, setErros] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState('')
  const [resultado, setResultado] = useState(null)
  const [mostrarCpf, setMostrarCpf] = useState(false)

  // Libera as URLs das prévias ao sair da tela.
  const fotosRef = useRef(fotos)
  fotosRef.current = fotos
  useEffect(
    () => () => fotosRef.current.forEach((f) => f && URL.revokeObjectURL(f.url)),
    [],
  )

  function alterarCampo(campo, valor) {
    setDados((d) => ({ ...d, [campo]: campo === 'cpf' ? formatarCpf(valor) : valor }))
    setErros((e) => ({ ...e, [campo]: undefined }))
  }

  function alterarFotos(novas) {
    setFotos(novas)
    setErros((e) => ({ ...e, fotos: undefined }))
  }

  function revisar(evento) {
    evento.preventDefault()
    const novosErros = validarDados(dados)
    const erroFotos = validarFotos(fotos)
    if (erroFotos) novosErros.fotos = erroFotos
    if (!consentimento) {
      novosErros.consentimento = 'Confirme a ciência e a autorização para continuar.'
    }
    setErros(novosErros)

    if (Object.keys(novosErros).length === 0) {
      setErroEnvio('')
      setEtapa('revisao')
      window.scrollTo({ top: 0 })
    } else {
      document.querySelector('[data-erro="true"], .erro-campo')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }

  async function salvar() {
    setEnviando(true)
    setErroEnvio('')
    try {
      const resposta = await cadastrarAluno(dados, fotos)
      setResultado(resposta)
      setEtapa('sucesso')
    } catch (erro) {
      setErroEnvio(erro.message)
    } finally {
      setEnviando(false)
    }
  }

  function novoCadastro() {
    fotos.forEach((f) => f && URL.revokeObjectURL(f.url))
    setDados(DADOS_VAZIOS)
    setFotos(fotosVazias())
    setConsentimento(false)
    setErros({})
    setResultado(null)
    setMostrarCpf(false)
    setEtapa('formulario')
  }

  if (etapa === 'sucesso') {
    return (
      <section className="painel centralizado">
        <h1>Cadastro enviado</h1>
        <p>
          <strong>{dados.nome.trim()}</strong>
          {resultado?.matricula && <> · matrícula {resultado.matricula}</>}
        </p>
        {resultado?.demo && (
          <p className="alerta aviso">
            Modo demonstração: nenhum dado foi salvo. Desative <code>VITE_MODO_DEMO</code> para enviar à
            API.
          </p>
        )}
        <button type="button" className="btn primario" onClick={novoCadastro}>
          Cadastrar outro aluno
        </button>
      </section>
    )
  }

  if (etapa === 'revisao') {
    return (
      <section className="painel">
        <h1>Revise o cadastro</h1>
        <p className="ajuda">Confira os dados e as fotos antes de salvar.</p>

        <dl className="resumo">
          <dt>Nome completo</dt>
          <dd>{dados.nome.trim().replace(/\s+/g, ' ')}</dd>
          <dt>Data de nascimento</dt>
          <dd>{formatarData(dados.nascimento)}</dd>
          <dt>CPF</dt>
          <dd>
            {mostrarCpf ? dados.cpf : mascararCpf(dados.cpf)}{' '}
            <button type="button" className="btn texto pequeno" onClick={() => setMostrarCpf((v) => !v)}>
              {mostrarCpf ? 'Ocultar' : 'Mostrar'}
            </button>
          </dd>
        </dl>

        <ul className="vagas revisao">
          {fotos.map((foto, i) => (
            <li key={i} className="vaga cheia">
              <div className="vaga-corpo">
                <img src={foto.url} alt={`Foto ${i + 1}`} />
              </div>
            </li>
          ))}
        </ul>

        {erroEnvio && (
          <p className="alerta erro" role="alert">
            {erroEnvio}
          </p>
        )}

        <div className="acoes-linha">
          <button type="button" className="btn secundario" onClick={() => setEtapa('formulario')} disabled={enviando}>
            Voltar e editar
          </button>
          <button type="button" className="btn primario" onClick={salvar} disabled={enviando}>
            {enviando ? 'Salvando…' : 'Salvar cadastro'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <form className="painel" onSubmit={revisar} noValidate>
      <h1>Cadastro de aluno</h1>
      <p className="ajuda">Todos os campos e as cinco fotos são obrigatórios.</p>

      <div className={`campo ${erros.nome ? 'invalido' : ''}`} data-erro={Boolean(erros.nome)}>
        <label htmlFor="nome">Nome completo</label>
        <input
          id="nome"
          type="text"
          autoComplete="off"
          value={dados.nome}
          onChange={(e) => alterarCampo('nome', e.target.value)}
          aria-invalid={Boolean(erros.nome)}
          aria-describedby={erros.nome ? 'erro-nome' : undefined}
        />
        {erros.nome && <p id="erro-nome" className="erro-campo">{erros.nome}</p>}
      </div>

      <div className="linha-campos">
        <div className={`campo ${erros.nascimento ? 'invalido' : ''}`} data-erro={Boolean(erros.nascimento)}>
          <label htmlFor="nascimento">Data de nascimento</label>
          <input
            id="nascimento"
            type="date"
            max={hojeIso()}
            value={dados.nascimento}
            onChange={(e) => alterarCampo('nascimento', e.target.value)}
            aria-invalid={Boolean(erros.nascimento)}
            aria-describedby={erros.nascimento ? 'erro-nascimento' : undefined}
          />
          {erros.nascimento && <p id="erro-nascimento" className="erro-campo">{erros.nascimento}</p>}
        </div>

        <div className={`campo ${erros.cpf ? 'invalido' : ''}`} data-erro={Boolean(erros.cpf)}>
          <label htmlFor="cpf">CPF</label>
          <input
            id="cpf"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={dados.cpf}
            onChange={(e) => alterarCampo('cpf', e.target.value)}
            aria-invalid={Boolean(erros.cpf)}
            aria-describedby={erros.cpf ? 'erro-cpf' : undefined}
          />
          {erros.cpf && <p id="erro-cpf" className="erro-campo">{erros.cpf}</p>}
        </div>
      </div>

      <CapturaFotos fotos={fotos} onChange={alterarFotos} erro={erros.fotos} />

      <div className={`campo consentimento ${erros.consentimento ? 'invalido' : ''}`}>
        <label className="caixa">
          <input
            type="checkbox"
            checked={consentimento}
            onChange={(e) => {
              setConsentimento(e.target.checked)
              setErros((er) => ({ ...er, consentimento: undefined }))
            }}
          />
          <span>
            Confirmo que a pessoa cadastrada (ou seu responsável legal) foi informada sobre o uso das
            fotos para reconhecimento facial e autorizou o cadastro. Dados biométricos são dados
            pessoais sensíveis (LGPD).
          </span>
        </label>
        {erros.consentimento && <p className="erro-campo">{erros.consentimento}</p>}
      </div>

      <div className="acoes-linha">
        <button type="submit" className="btn primario">
          Revisar cadastro
        </button>
      </div>
    </form>
  )
}
