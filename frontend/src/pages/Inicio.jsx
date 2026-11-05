const ATALHOS = [
  {
    href: '#horarios',
    titulo: 'Horários de entrada e saída',
    texto: 'Consulta de permanência com acesso do administrador.',
    disponivel: true,
  },
  {
    href: '#cadastro',
    titulo: 'Cadastrar aluno',
    texto: 'Dados pessoais e cinco fotos do rosto.',
    disponivel: true,
  },
  {
    href: '#identificacao',
    titulo: 'Identificar pela câmera',
    texto: 'Vídeo ao vivo e cartão do aluno reconhecido.',
    disponivel: true,
  },
  {
    href: '#consulta',
    titulo: 'Consultar cadastros',
    texto: 'Lista de alunos com foto e busca por nome.',
    disponivel: true,
  },
]

export default function Inicio() {
  return (
    <>
      <h1>Painel inicial</h1>
      <p className="ajuda">Cadastre o aluno com cinco fotos e use a câmera para exibir seu cartão de identificação.</p>

      <div className="grade-atalhos">
        {ATALHOS.map(({ href, titulo, texto, disponivel }) => (
          <a key={href} href={href} className={`atalho ${disponivel ? '' : 'em-breve'}`}>
            <h2>{titulo}</h2>
            <p>{texto}</p>
            <span className="etiqueta">{disponivel ? 'Disponível' : 'Em desenvolvimento'}</span>
          </a>
        ))}
      </div>
    </>
  )
}
