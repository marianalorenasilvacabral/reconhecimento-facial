CREATE TABLE IF NOT EXISTS empresas_mobile (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  responsavel VARCHAR(120) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  cnpj VARCHAR(14),
  cep VARCHAR(8),
  endereco JSONB NOT NULL DEFAULT '{}',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessoes_mobile (
  token_hash VARCHAR(64) PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas_mobile(id) ON DELETE CASCADE,
  expira_em TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessoes_mobile_expiracao ON sessoes_mobile(expira_em);
CREATE TABLE IF NOT EXISTS funcionarios_mobile (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id BIGINT NOT NULL REFERENCES empresas_mobile(id) ON DELETE CASCADE,
  aluno_id BIGINT NOT NULL UNIQUE REFERENCES alunos(id) ON DELETE CASCADE,
  cargo VARCHAR(80) NOT NULL DEFAULT '',
  jornada JSONB NOT NULL,
  foto_resumo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS funcionarios_mobile_empresa ON funcionarios_mobile(empresa_id, ativo);
CREATE TABLE IF NOT EXISTS pontos_mobile (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  funcionario_id BIGINT NOT NULL REFERENCES funcionarios_mobile(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  entrada TIMESTAMPTZ NOT NULL,
  saida_almoco TIMESTAMPTZ,
  retorno_almoco TIMESTAMPTZ,
  saida TIMESTAMPTZ,
  jornada JSONB NOT NULL,
  UNIQUE(funcionario_id, data),
  CHECK (saida_almoco IS NULL OR saida_almoco >= entrada),
  CHECK (retorno_almoco IS NULL OR (saida_almoco IS NOT NULL AND retorno_almoco >= saida_almoco)),
  CHECK (saida IS NULL OR (retorno_almoco IS NOT NULL AND saida >= retorno_almoco))
);
