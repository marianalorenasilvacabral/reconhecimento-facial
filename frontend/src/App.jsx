import { useEffect, useState } from 'react'
import Inicio from './pages/Inicio.jsx'
import CadastroAluno from './pages/CadastroAluno.jsx'
import Identificacao from './pages/Identificacao.jsx'
import ConsultaAlunos from './pages/ConsultaAlunos.jsx'
import CameraCelular from './pages/CameraCelular.jsx'
import Horarios from './pages/Horarios.jsx'

const PAGINAS = {
  inicio: { rotulo: 'Início', componente: Inicio },
  cadastro: { rotulo: 'Cadastro', componente: CadastroAluno },
  identificacao: { rotulo: 'Identificação', componente: Identificacao },
  consulta: { rotulo: 'Consulta', componente: ConsultaAlunos },
  horarios: { rotulo: 'Horários', componente: Horarios },
}

const lerRota = () => {
  const r = window.location.hash.replace('#', '')
  return r in PAGINAS ? r : 'inicio'
}

// Página aberta no celular pelo QR code: #celular/<token>. Sem menu, sem acesso às demais telas.
const lerTokenCelular = () => {
  const m = window.location.hash.match(/^#celular\/([A-Za-z0-9_-]{8,128})$/)
  return m ? m[1] : null
}

export default function App() {
  const [rota, setRota] = useState(lerRota)
  const [tokenCelular, setTokenCelular] = useState(lerTokenCelular)

  useEffect(() => {
    const aoMudar = () => {
      setRota(lerRota())
      setTokenCelular(lerTokenCelular())
    }
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])

  if (tokenCelular) {
    return (
      <div className="app">
        <main className="conteudo">
          <CameraCelular token={tokenCelular} />
        </main>
      </div>
    )
  }

  const Pagina = PAGINAS[rota].componente

  return (
    <div className="app">
      <header className="topo">
        <a className="marca" href="#inicio">
          <span className="marca-icone" aria-hidden="true">◉</span>
          Reconhecimento de Alunos
        </a>
        <nav aria-label="Navegação principal">
          {Object.entries(PAGINAS).map(([chave, { rotulo }]) => (
            <a
              key={chave}
              href={`#${chave}`}
              className={chave === rota ? 'ativo' : ''}
              aria-current={chave === rota ? 'page' : undefined}
            >
              {rotulo}
            </a>
          ))}
        </nav>
      </header>

      <main className="conteudo">
        <Pagina />
      </main>

      <footer className="rodape">
        Protótipo acadêmico · use apenas dados fictícios ou de participantes informados e que
        concordaram com o teste.
      </footer>
    </div>
  )
}
