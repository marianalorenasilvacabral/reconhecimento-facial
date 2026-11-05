import { formatarData, mascararCpf } from '../utils/validacao.js'
import { formatarDuracao, formatarHorario } from '../utils/horarios.js'

// A API já devolve o CPF mascarado (***.***.***-25); aceita também um CPF completo.
const cpfParaExibir = (cpf) => (String(cpf ?? '').includes('*') ? cpf : mascararCpf(cpf))

/**
 * Cartão do aluno (Etapa 5). Sem `aluno`, mostra o estado "Aguardando identificação".
 * Exibe apenas os campos necessários; o CPF sempre mascarado.
 */
export default function CartaoAluno({ aluno }) {
  if (!aluno) {
    return (
      <aside className="cartao vazio" aria-live="polite">
        <p className="cartao-status">Aguardando identificação</p>
        <p className="ajuda">Os dados do aluno aparecerão aqui quando houver uma correspondência confiável.</p>
      </aside>
    )
  }

  return (
    <aside className="cartao" aria-live="polite">
      <p className="cartao-status ok">Aluno identificado</p>
      <h3>{aluno.nome}</h3>
      {aluno.matricula && <p className="ajuda">Matrícula: {aluno.matricula}</p>}
      <dl>
        <dt>Data de nascimento</dt>
        <dd>{formatarData(aluno.data_nascimento ?? aluno.nascimento)}</dd>
        <dt>CPF</dt>
        <dd>{cpfParaExibir(aluno.cpf)}</dd>
        {aluno.turma && (
          <>
            <dt>Turma</dt>
            <dd>{aluno.turma}</dd>
          </>
        )}
      </dl>
      {aluno.ponto ? (
        <section className={`ponto-cartao ${aluno.ponto.movimento}`} aria-label="Registro de ponto" aria-live="polite">
          <h3>{{ entrada: 'Entrada registrada', saida_almoco: 'Saída para almoço registrada', retorno_almoco: 'Retorno do almoço registrado', saida: 'Saída registrada' }[aluno.ponto.movimento]}</h3>
          <dl>
            <dt>Horário de chegada</dt>
            <dd>{formatarHorario(aluno.ponto.entrada)}</dd>
            {aluno.ponto.saida_almoco && <><dt>Saída para almoço</dt><dd>{formatarHorario(aluno.ponto.saida_almoco)}</dd></>}
            {aluno.ponto.retorno_almoco && <><dt>Retorno do almoço</dt><dd>{formatarHorario(aluno.ponto.retorno_almoco)}</dd></>}
            {aluno.ponto.saida && <>
              <dt>Horário de saída</dt>
              <dd>{formatarHorario(aluno.ponto.saida)}</dd>
            </>}
            <dt>{aluno.ponto.saida ? 'Tempo no local' : 'Permanência até agora'}</dt>
            <dd>{formatarDuracao(aluno.ponto.duracao_segundos)}</dd>
          </dl>
          <p className="ajuda">Horário de Brasília</p>
        </section>
      ) : <p className="ajuda">Confirmando a marcação de ponto…</p>}
    </aside>
  )
}
