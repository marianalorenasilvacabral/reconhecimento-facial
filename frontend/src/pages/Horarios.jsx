import { useEffect, useState } from 'react'
import { autenticarAdmin, estadoAdmin, listarPontos, sairAdmin } from '../services/api.js'
import { formatarDuracao, formatarHorario } from '../utils/horarios.js'

const FILTROS_VAZIOS = { nome: '', inicio: '', fim: '' }

export default function Horarios() {
  const [acesso, setAcesso] = useState(null)
  const [erro, setErro] = useState('')
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const [rascunho, setRascunho] = useState(FILTROS_VAZIOS)
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS)
  const [offset, setOffset] = useState(0)
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [atualizacao, setAtualizacao] = useState(0)

  useEffect(() => {
    let ativo = true
    setErro('')
    estadoAdmin().then((info) => { if (ativo) setAcesso(info) })
      .catch((e) => { if (ativo) setErro(e.message) })
    return () => { ativo = false }
  }, [tentativa])

  useEffect(() => {
    if (!acesso?.autenticado) return undefined
    let ativo = true
    const controle = new AbortController()
    setCarregando(true)
    listarPontos({ ...filtros, offset, limite: 50 }, controle.signal)
      .then((resultado) => {
        if (ativo) { setDados(resultado); setErro('') }
      }).catch((e) => {
        if (!ativo) return
        setDados(null)
        setErro(e.message)
        if (e.status === 401) setAcesso((anterior) => ({ ...anterior, autenticado: false }))
      }).finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false; controle.abort() }
  }, [acesso?.autenticado, filtros, offset, atualizacao])

  useEffect(() => {
    if (!acesso?.autenticado) return undefined
    const intervalo = setInterval(() => {
      if (!document.hidden) setAtualizacao((n) => n + 1)
    }, 15000)
    return () => clearInterval(intervalo)
  }, [acesso?.autenticado])

  async function entrar(evento) {
    evento.preventDefault()
    setErro('')
    if (!acesso.configurado && senha !== confirmacao) {
      setErro('As senhas não coincidem.')
      return
    }
    setEnviando(true)
    try {
      const resultado = await autenticarAdmin(usuario, senha, !acesso.configurado)
      setSenha(''); setConfirmacao(''); setAcesso(resultado)
    } catch (e) {
      setErro(e.message)
      if (e.status === 409) setAcesso((anterior) => ({ ...anterior, configurado: true }))
    } finally { setEnviando(false) }
  }

  async function sair() {
    setEnviando(true)
    try {
      await sairAdmin()
      setDados(null); setSenha(''); setConfirmacao('')
      setAcesso({ configurado: true, autenticado: false })
      setErro('')
    } catch (e) { setErro(e.message) }
    finally { setEnviando(false) }
  }

  if (!acesso) return <section className="painel">
    <h1>Horários</h1>
    {erro ? <><p role="alert" className="alerta erro">{erro}</p><button className="btn secundario" onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</button></> : <p role="status">Verificando acesso…</p>}
  </section>

  if (!acesso.autenticado) return <section className="painel login-admin">
    <h1>{acesso.configurado ? 'Acesso do administrador' : 'Criar administrador'}</h1>
    <p className="ajuda">{acesso.configurado ? 'Entre para consultar entradas, saídas e o tempo de permanência.' : 'Este é o primeiro acesso. Defina o usuário e a senha que protegerão os horários.'}</p>
    <form onSubmit={entrar} className="form-admin">
      <div className="campo"><label htmlFor="usuario-admin">Usuário do administrador</label>
        <input id="usuario-admin" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required minLength={3} maxLength={60} />
      </div>
      <div className="campo"><label htmlFor="senha-admin">Senha</label>
        <input id="senha-admin" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={acesso.configurado ? 'current-password' : 'new-password'} required minLength={acesso.configurado ? undefined : 8} maxLength={128} />
      </div>
      {!acesso.configurado && <div className="campo"><label htmlFor="confirmacao-admin">Confirme a senha</label>
        <input id="confirmacao-admin" type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" required minLength={8} maxLength={128} />
        <p className="ajuda">Use pelo menos oito caracteres. Guarde essa senha; ela é independente da senha do PostgreSQL.</p>
      </div>}
      {erro && <p role="alert" className="alerta erro">{erro}</p>}
      <button type="submit" className="btn primario" disabled={enviando}>{enviando ? 'Aguarde…' : acesso.configurado ? 'Entrar' : 'Criar administrador'}</button>
    </form>
  </section>

  function filtrar(evento) {
    evento.preventDefault()
    setOffset(0); setDados(null); setFiltros({ ...rascunho })
  }

  return <section className="painel painel-horarios">
    <div className="cabecalho-horarios">
      <div><h1>Entradas e saídas</h1><p className="ajuda">Administrador: {acesso.usuario}</p></div>
      <button type="button" className="btn secundario" onClick={sair} disabled={enviando}>Sair da administração</button>
    </div>
    <form className="filtros-horarios" onSubmit={filtrar}>
      <div className="campo"><label htmlFor="filtro-nome">Nome da pessoa</label><input id="filtro-nome" value={rascunho.nome} onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })} maxLength={120} /></div>
      <div className="campo"><label htmlFor="filtro-inicio">Entrada a partir de</label><input id="filtro-inicio" type="date" value={rascunho.inicio} onChange={(e) => setRascunho({ ...rascunho, inicio: e.target.value })} /></div>
      <div className="campo"><label htmlFor="filtro-fim">Entrada até</label><input id="filtro-fim" type="date" value={rascunho.fim} min={rascunho.inicio || undefined} onChange={(e) => setRascunho({ ...rascunho, fim: e.target.value })} /></div>
      <button className="btn primario" type="submit">Filtrar</button>
    </form>
    {erro && <p className="alerta erro" role="alert">{erro}</p>}
    <div className="resumo-ponto" aria-live="polite">
      <div><span>Registros encontrados</span><strong>{dados?.total ?? '—'}</strong></div>
      <div><span>Sem saída registrada</span><strong>{dados?.abertos ?? '—'}</strong></div>
      <div><span>Permanência total no filtro</span><strong>{dados ? formatarDuracao(dados.total_segundos) : '—'}</strong></div>
    </div>
    <p className="ajuda">Horários de Brasília. O período filtra a data de entrada. Registros em aberto contam o tempo até a última atualização.</p>
    {carregando && <p role="status">Atualizando horários…</p>}
    {dados && <>
      <div className="tabela-horarios-container"><table className="tabela-horarios">
        <caption>Registros de entrada, saída e permanência</caption>
        <thead><tr><th scope="col">Pessoa</th><th scope="col">Chegada</th><th scope="col">Saída</th><th scope="col">Tempo no local</th></tr></thead>
        <tbody>{dados.registros.map((registro) => <tr key={registro.id}>
          <td><strong>{registro.nome}</strong><span className="matricula-horarios">Matrícula {registro.matricula}</span></td>
          <td>{formatarHorario(registro.entrada)}</td>
          <td>{registro.saida ? formatarHorario(registro.saida) : <span className="etiqueta">No local</span>}</td>
          <td>{formatarDuracao(registro.duracao_segundos)}{!registro.saida && <span className="matricula-horarios">Em andamento</span>}</td>
        </tr>)}</tbody>
      </table></div>
      {dados.total === 0 && <p>Nenhum registro de ponto encontrado para este filtro.</p>}
      <div className="acoes-linha">
        <button type="button" className="btn secundario" disabled={offset === 0 || carregando} onClick={() => setOffset((n) => Math.max(0, n - 50))}>Anterior</button>
        <span>Página {Math.floor(offset / 50) + 1}</span>
        <button type="button" className="btn secundario" disabled={offset + 50 >= dados.total || carregando} onClick={() => setOffset((n) => n + 50)}>Próxima</button>
        <button type="button" className="btn secundario" onClick={() => setAtualizacao((n) => n + 1)} disabled={carregando}>Atualizar horários</button>
      </div>
      <p className="ajuda">Atualizado em {formatarHorario(dados.horario_servidor)}. Atualização automática a cada 15 segundos.</p>
    </>}
  </section>
}
