import { useEffect, useId, useRef, useState } from 'react'
import { autenticarAdmin, estadoAdmin, excluirAluno } from '../services/api.js'

export default function ExcluirCadastro({ aluno, aoExcluir }) {
  const dialogo = useRef(null)
  const tituloId = useId()
  const [aberto, setAberto] = useState(false)
  const [acesso, setAcesso] = useState(null)
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [excluindo, setExcluindo] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (aberto) dialogo.current.showModal()
    else dialogo.current.close()
  }, [aberto])

  useEffect(() => {
    if (!aberto) return undefined
    let ativo = true
    setAcesso(null)
    setErro('')
    estadoAdmin().then((info) => { if (ativo) setAcesso(info) })
      .catch((e) => { if (ativo) setErro(e.message) })
    return () => { ativo = false }
  }, [aberto, tentativa])

  function fechar() {
    if (excluindo) return
    setSenha('')
    setErro('')
    setAberto(false)
  }

  async function confirmar(evento) {
    evento.preventDefault()
    if (!acesso?.configurado || excluindo) return
    setErro('')
    setExcluindo(true)
    try {
      if (!acesso.autenticado) {
        const autenticacao = await autenticarAdmin(usuario, senha)
        setAcesso(autenticacao)
        setSenha('')
      }
      await excluirAluno(aluno.id)
      setSenha('')
      setAberto(false)
      aoExcluir(aluno)
    } catch (e) {
      setErro(e.message)
      setSenha('')
      if (e.status === 401) setAcesso((anterior) => ({ ...anterior, autenticado: false }))
    } finally { setExcluindo(false) }
  }

  return <>
    <button type="button" className="btn perigo" onClick={() => { setAcesso(null); setErro(''); setAberto(true) }}>Excluir cadastro</button>
    <dialog ref={dialogo} className="dialogo-exclusao" aria-labelledby={tituloId}
      onCancel={(evento) => { if (excluindo) evento.preventDefault() }}
      onClose={() => { setSenha(''); setAberto(false) }}>
      <form className="form-exclusao" onSubmit={confirmar}>
        <h2 id={tituloId}>Excluir cadastro de {aluno.nome}?</h2>
        <p>Essa ação é permanente: apaga os dados do cadastro, as cinco fotos, os dados de reconhecimento facial e todo o histórico de entrada e saída desta pessoa.</p>
        {!acesso && !erro && <p role="status">Verificando acesso do administrador…</p>}
        {acesso && !acesso.configurado && <p>Crie primeiro o administrador na aba <a href="#horarios" onClick={fechar}>Horários</a>. Depois volte à Consulta para excluir o cadastro.</p>}
        {acesso?.autenticado && <p className="ajuda">Administrador: {acesso.usuario}</p>}
        {acesso?.configurado && !acesso.autenticado && <>
          <p className="ajuda">Entre com o administrador para autorizar esta exclusão.</p>
          <div className="campo"><label htmlFor={`${tituloId}-usuario`}>Usuário do administrador</label>
            <input id={`${tituloId}-usuario`} value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required maxLength={60} disabled={excluindo} />
          </div>
          <div className="campo"><label htmlFor={`${tituloId}-senha`}>Senha do administrador</label>
            <input id={`${tituloId}-senha`} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required maxLength={128} disabled={excluindo} />
          </div>
        </>}
        {erro && <p className="alerta erro" role="alert">{erro}</p>}
        <div className="acoes-linha">
          <button type="button" className="btn secundario" onClick={fechar} disabled={excluindo} autoFocus>Cancelar</button>
          {!acesso && erro && <button type="button" className="btn secundario" onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</button>}
          {acesso?.configurado && <button type="submit" className="btn perigo" disabled={excluindo}>
            {excluindo ? 'Excluindo…' : acesso.autenticado ? 'Excluir definitivamente' : 'Entrar e excluir cadastro'}
          </button>}
        </div>
      </form>
    </dialog>
  </>
}
