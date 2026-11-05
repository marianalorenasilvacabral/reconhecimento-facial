import { createHash } from 'node:crypto'
import { transacao } from '../database/pool.js'
import { validar, funcionarioSchema, edicaoFuncionarioSchema } from '../services/validacao.js'
import { calcularMes } from '../services/calculoPonto.js'

const selecao = `SELECT f.id, f.aluno_id, f.cargo, f.jornada, f.ativo, f.foto_resumo, f.criado_em,
 a.nome, a.matricula, a.data_nascimento AS nascimento, concat('***.***.***-', right(a.cpf,2)) AS cpf,
 (SELECT to_jsonb(p) FROM pontos_mobile p WHERE p.funcionario_id=f.id AND p.data=(now() AT TIME ZONE 'America/Sao_Paulo')::date LIMIT 1) AS ponto_hoje
 FROM funcionarios_mobile f JOIN alunos a ON a.id=f.aluno_id`
const ausente = (res) => res.status(404).json({ erro: 'Funcionário não encontrado nesta empresa.' })

export function funcionarioController(banco, analisarFotos) {
  return {
    listar: async (req, res) => {
      const ordens = { nome: 'a.nome ASC, f.id ASC', nome_desc: 'a.nome DESC, f.id DESC', cargo: 'f.cargo ASC, a.nome ASC', recentes: 'f.criado_em DESC, f.id DESC' }
      const ordem = ordens[req.query.ordem || 'nome']
      if (!ordem) return res.status(422).json({ erro: 'Ordenação inválida.' })
      const nome = String(req.query.nome || '').slice(0, 120)
      const { rows } = await banco.query(`${selecao} WHERE f.empresa_id=$1 AND a.nome ILIKE $2 ORDER BY ${ordem}`, [req.empresa.id, `%${nome}%`])
      res.json(rows)
    },
    detalhe: async (req, res) => {
      const { rows: [funcionario] } = await banco.query(`${selecao} WHERE f.empresa_id=$1 AND f.id=$2`, [req.empresa.id, req.params.id])
      if (!funcionario) return ausente(res)
      res.json(funcionario)
    },
    cadastrar: async (req, res) => {
      const dados = validar(funcionarioSchema, req.body)
      const fotos = await analisarFotos(dados.fotos)
      const funcionario = await transacao(banco, async (conexao) => {
        const { rows: [aluno] } = await conexao.query('INSERT INTO alunos(nome,data_nascimento,cpf,consentimento_em,ativo) VALUES($1,$2,$3,now(),$4) RETURNING id,matricula', [dados.nome, dados.nascimento, dados.cpf, dados.ativo])
        for (let i = 0; i < fotos.length; i++) {
          const foto = fotos[i]
          const { rows: [imagem] } = await conexao.query('INSERT INTO imagens_faciais(aluno_id,posicao,tipo_mime,tamanho_bytes,sha256,conteudo) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [aluno.id, i + 1, foto.tipo_mime, foto.conteudo.length, createHash('sha256').update(foto.conteudo).digest('hex'), foto.conteudo])
          const vetor = Buffer.alloc(128 * 4)
          foto.vetor.forEach((valor, indice) => vetor.writeFloatLE(valor, indice * 4))
          await conexao.query('INSERT INTO embeddings_faciais(aluno_id,imagem_id,modelo,dimensao,vetor) VALUES($1,$2,$3,128,$4)', [aluno.id, imagem.id, foto.modelo, vetor])
        }
        const { rows: [novo] } = await conexao.query('INSERT INTO funcionarios_mobile(empresa_id,aluno_id,cargo,jornada,foto_resumo,ativo) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', [req.empresa.id, aluno.id, dados.cargo, dados.jornada, fotos[0].miniatura || null, dados.ativo])
        return { ...novo, nome: dados.nome, matricula: aluno.matricula }
      })
      res.status(201).json(funcionario)
    },
    atualizar: async (req, res) => {
      const dados = validar(edicaoFuncionarioSchema, req.body)
      const atualizado = await transacao(banco, async (conexao) => {
        const { rows: [funcionario] } = await conexao.query('SELECT a.id AS aluno_id FROM funcionarios_mobile f JOIN alunos a ON a.id=f.aluno_id WHERE f.id=$1 AND f.empresa_id=$2 FOR UPDATE OF a', [req.params.id, req.empresa.id])
        if (!funcionario) return false
        await conexao.query('UPDATE alunos SET nome=$1, ativo=$2 WHERE id=$3', [dados.nome, dados.ativo, funcionario.aluno_id])
        await conexao.query('UPDATE funcionarios_mobile SET cargo=$1,jornada=$2,ativo=$3 WHERE id=$4 AND empresa_id=$5', [dados.cargo, dados.jornada, dados.ativo, req.params.id, req.empresa.id])
        return true
      })
      if (!atualizado) return ausente(res)
      res.json({ atualizado: true })
    },
    excluir: async (req, res) => {
      const excluido = await transacao(banco, async (conexao) => {
        const { rows: [funcionario] } = await conexao.query('SELECT a.id AS aluno_id FROM funcionarios_mobile f JOIN alunos a ON a.id=f.aluno_id WHERE f.id=$1 AND f.empresa_id=$2 FOR UPDATE OF a', [req.params.id, req.empresa.id])
        if (!funcionario) return false
        await conexao.query('DELETE FROM alunos WHERE id=$1', [funcionario.aluno_id])
        return true
      })
      if (!excluido) return ausente(res)
      res.sendStatus(204)
    },
    ponto: async (req, res) => {
      const mes = String(req.query.mes || '')
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || Number(mes.slice(0,4)) < 1900 || Number(mes.slice(0,4)) > 2200) return res.status(422).json({ erro: 'Informe um mês válido no formato AAAA-MM.' })
      const { rows: [funcionario] } = await banco.query(`${selecao} WHERE f.empresa_id=$1 AND f.id=$2`, [req.empresa.id, req.params.id])
      if (!funcionario) return ausente(res)
      const { rows } = await banco.query('SELECT id, to_char(data, \'YYYY-MM-DD\') AS data, entrada, saida_almoco, retorno_almoco, saida, jornada FROM pontos_mobile WHERE funcionario_id=$1 AND data >= $2::date AND data < ($2::date + interval \'1 month\') ORDER BY data ASC', [funcionario.id, `${mes}-01`])
      res.json({ funcionario, mes, ...calcularMes(rows) })
    },
  }
}
