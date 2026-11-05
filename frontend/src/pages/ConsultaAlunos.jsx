import { useEffect, useState } from 'react'
import { MODO_DEMO_ATIVO, listarAlunos, obterAluno, urlFoto } from '../services/api.js'
import { ROTULOS_FOTOS, formatarData } from '../utils/validacao.js'
import ExcluirCadastro from '../components/ExcluirCadastro.jsx'

function Miniatura({ aluno }) {
  const [falhou, setFalhou] = useState(false)
  const iniciais = aluno.nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  return falhou ? (
    <span className="miniatura sem-foto" aria-hidden="true">{iniciais}</span>
  ) : (
    <img
      className="miniatura"
      src={urlFoto(aluno.id, 1)}
      alt={`Foto de ${aluno.nome}`}
      loading="lazy"
      onError={() => setFalhou(true)}
    />
  )
}

function Detalhe({ aluno, onFechar, aoExcluir }) {
  const [info, setInfo] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    setInfo(null)
    setErro('')
    obterAluno(aluno.id)
      .then((dados) => ativo && setInfo(dados))
      .catch((e) => ativo && setErro(e.message))
    return () => {
      ativo = false
    }
  }, [aluno.id])

  const total = info?.total_fotos ?? 0

  return (
    <section className="painel detalhe" aria-label={`Cadastro de ${aluno.nome}`}>
      <div className="detalhe-topo">
        <div>
          <h2>{aluno.nome}</h2>
          <p className="ajuda">Matrícula {aluno.matricula}</p>
        </div>
        <button type="button" className="btn secundario" onClick={onFechar}>
          Fechar
        </button>
      </div>

      <dl className="resumo">
        <dt>Data de nascimento</dt>
        <dd>{formatarData(aluno.data_nascimento)}</dd>
        <dt>CPF</dt>
        <dd>{aluno.cpf}</dd>
        <dt>Turma</dt>
        <dd>{aluno.turma ?? '—'}</dd>
        {info && (
          <>
            <dt>Cadastrado em</dt>
            <dd>{new Date(info.criado_em).toLocaleString('pt-BR')}</dd>
          </>
        )}
      </dl>

      {erro && <p className="alerta erro" role="alert">{erro}</p>}

      <ul className="vagas revisao">
        {Array.from({ length: total }, (_, i) => i + 1).map((posicao) => (
          <li key={posicao} className="vaga cheia">
            <a
              className="vaga-corpo"
              href={urlFoto(aluno.id, posicao)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Abrir foto ${posicao} (${ROTULOS_FOTOS[posicao - 1]}) em tamanho real`}
            >
              <img src={urlFoto(aluno.id, posicao)} alt={`Foto ${posicao} de ${aluno.nome}`} />
            </a>
            <span className="vaga-rotulo">{ROTULOS_FOTOS[posicao - 1]}</span>
          </li>
        ))}
      </ul>
      <div className="acoes-exclusao">
        <ExcluirCadastro aluno={aluno} aoExcluir={aoExcluir} />
      </div>
    </section>
  )
}

export default function ConsultaAlunos() {
  const [busca, setBusca] = useState('')
  const [alunos, setAlunos] = useState(null) // null = carregando
  const [erro, setErro] = useState('')
  const [selecionado, setSelecionado] = useState(null)
  const [recarga, setRecarga] = useState(0)
  const [mensagem, setMensagem] = useState('')

  function cadastroExcluido(aluno) {
    setSelecionado((atual) => atual?.id === aluno.id ? null : atual)
    setAlunos((atuais) => atuais?.filter((atual) => atual.id !== aluno.id) ?? null)
    setMensagem(`Cadastro de ${aluno.nome} excluído com sucesso.`)
    setRecarga((n) => n + 1)
  }

  useEffect(() => {
    if (MODO_DEMO_ATIVO) return undefined
    let ativo = true
    const espera = setTimeout(
      async () => {
        try {
          const lista = await listarAlunos(busca)
          if (!ativo) return
          setAlunos(lista)
          setErro('')
        } catch (e) {
          if (!ativo) return
          setAlunos([])
          setErro(e.message)
        }
      },
      busca ? 300 : 0,
    )
    return () => {
      ativo = false
      clearTimeout(espera)
    }
  }, [busca, recarga])

  if (MODO_DEMO_ATIVO) {
    return (
      <>
        <h1>Consulta de alunos</h1>
        <p className="alerta aviso">
          O modo demonstração está ligado, então não há dados para consultar. Em{' '}
          <code>frontend/.env</code>, troque <code>VITE_MODO_DEMO</code> para <code>false</code> e
          reinicie o <code>npm run dev</code>.
        </p>
      </>
    )
  }

  return (
    <>
      <h1>Consulta de alunos</h1>
      <p className="ajuda">
        Alunos cadastrados com a primeira foto de cada um. Clique em um aluno para ver as cinco fotos.
      </p>

      <div className="barra-busca">
        <div className="campo">
          <label htmlFor="busca">Buscar por nome</label>
          <input
            id="busca"
            type="text"
            autoComplete="off"
            placeholder="Digite parte do nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <button type="button" className="btn secundario" onClick={() => setRecarga((n) => n + 1)}>
          Atualizar
        </button>
      </div>

      {erro && <p className="alerta erro" role="alert">{erro}</p>}

      {mensagem && <p className="alerta sucesso" role="status">{mensagem}</p>}
      {selecionado && <Detalhe key={selecionado.id} aluno={selecionado} onFechar={() => setSelecionado(null)} aoExcluir={cadastroExcluido} />}

      {alunos === null && !erro && <p className="ajuda">Carregando…</p>}

      {alunos !== null && alunos.length === 0 && !erro && (
        <p className="ajuda">
          {busca
            ? 'Nenhum aluno encontrado com esse nome.'
            : 'Nenhum aluno cadastrado ainda. Use a aba Cadastro para incluir o primeiro.'}
        </p>
      )}

      {alunos !== null && alunos.length > 0 && (
        <>
          <p className="ajuda" aria-live="polite">
            {alunos.length} {alunos.length === 1 ? 'aluno' : 'alunos'}
          </p>
          <ul className="lista-alunos">
            {alunos.map((aluno) => (
              <li key={aluno.id}>
                <button
                  type="button"
                  className={`cartao-lista ${selecionado?.id === aluno.id ? 'ativo' : ''}`}
                  onClick={() => setSelecionado(aluno)}
                  aria-pressed={selecionado?.id === aluno.id}
                >
                  <Miniatura aluno={aluno} />
                  <span className="cartao-lista-texto">
                    <strong>{aluno.nome}</strong>
                    <span>Matrícula {aluno.matricula}</span>
                    <span>CPF {aluno.cpf}</span>
                    <span>{aluno.turma ?? 'Sem turma'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
