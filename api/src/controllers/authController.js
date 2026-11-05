import { validar, cadastroEmpresaSchema, loginSchema } from '../services/validacao.js'
import { conferirSenha, criarSessao, gerarHash, hashToken } from '../services/seguranca.js'
import { transacao } from '../database/pool.js'

const hashFicticio = await gerarHash('credencial-inexistente-para-comparacao')

export function authController(banco) {
  return {
    cadastrar: async (req, res) => {
      const dados = validar(cadastroEmpresaSchema, req.body)
      const resultado = await transacao(banco, async (conexao) => {
        const { rows: [empresa] } = await conexao.query('INSERT INTO empresas_mobile(nome, responsavel, email, senha_hash, cnpj, cep, endereco) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
          [dados.nome, dados.responsavel, dados.email, await gerarHash(dados.senha), dados.cnpj || null, dados.cep || null, dados.endereco])
        return criarSessao(conexao, empresa)
      })
      res.status(201).json(resultado)
    },
    entrar: async (req, res) => {
      const dados = validar(loginSchema, req.body)
      const { rows: [empresa] } = await banco.query('SELECT * FROM empresas_mobile WHERE email=$1', [dados.email])
      const correta = await conferirSenha(dados.senha, empresa?.senha_hash || hashFicticio)
      if (!empresa || !correta) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' })
      res.json(await criarSessao(banco, empresa))
    },
    sair: async (req, res) => {
      await banco.query('DELETE FROM sessoes_mobile WHERE token_hash=$1', [hashToken(req.token)])
      res.sendStatus(204)
    },
    empresa: async (req, res) => {
      const { rows: [resumo] } = await banco.query(`SELECT
        (SELECT count(*)::int FROM funcionarios_mobile WHERE empresa_id=$1) AS total,
        (SELECT count(*)::int FROM funcionarios_mobile WHERE empresa_id=$1 AND ativo) AS ativos,
        (SELECT count(*)::int FROM pontos_mobile p JOIN funcionarios_mobile f ON f.id=p.funcionario_id WHERE f.empresa_id=$1 AND p.data=(now() AT TIME ZONE 'America/Sao_Paulo')::date AND p.saida IS NULL) AS no_local`, [req.empresa.id])
      res.json({ empresa: req.empresa, resumo })
    },
  }
}
