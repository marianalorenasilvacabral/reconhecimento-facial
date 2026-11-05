-- Esquema do banco (PostgreSQL 14+). Etapa 3: cadastro de alunos e imagens faciais.
-- Execute com:  psql "$DATABASE_URL" -f schema.sql
-- O mesmo esquema é definido em modelos.py (SQLAlchemy); mantenha os dois alinhados.

BEGIN;

-- Numeração das matrículas: ano + sequência (ex.: 2026001).
CREATE SEQUENCE IF NOT EXISTS matricula_seq START 1;

-- Mantém no mínimo três dígitos sem cortar a sequência após 999.
CREATE OR REPLACE FUNCTION gerar_matricula() RETURNS text AS $$
DECLARE
    numero text := nextval('matricula_seq')::text;
BEGIN
    RETURN to_char(now(), 'YYYY') || lpad(numero, GREATEST(3, length(numero)), '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS alunos (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    matricula               VARCHAR(20) NOT NULL UNIQUE
                            DEFAULT gerar_matricula(),
    nome                    VARCHAR(120) NOT NULL,
    data_nascimento         DATE NOT NULL,
    cpf                     CHAR(11) NOT NULL UNIQUE,      -- somente dígitos; a unicidade impede cadastro duplicado
    turma                   VARCHAR(60),                   -- opcional; aparece no cartão do aluno
    consentimento_em        TIMESTAMPTZ NOT NULL,          -- quando a autorização foi confirmada na tela de cadastro
    ativo                   BOOLEAN NOT NULL DEFAULT TRUE, -- inativar em vez de apagar, até definir a política de retenção
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT alunos_cpf_formato      CHECK (cpf ~ '^[0-9]{11}$'),
    CONSTRAINT alunos_nome_nao_vazio   CHECK (length(btrim(nome)) >= 3),
    CONSTRAINT alunos_nascimento_valido CHECK (data_nascimento >= DATE '1900-01-01' AND data_nascimento <= CURRENT_DATE)
);

-- Atualiza também bancos existentes, preservando matrículas e cadastros anteriores.
ALTER TABLE alunos ALTER COLUMN matricula SET DEFAULT gerar_matricula();

-- As cinco fotos de referência de cada aluno (posição 1 a 5, como nas vagas da tela).
CREATE TABLE IF NOT EXISTS imagens_faciais (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aluno_id        BIGINT NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    posicao         SMALLINT NOT NULL,
    tipo_mime       VARCHAR(20) NOT NULL,
    tamanho_bytes   INTEGER NOT NULL,
    sha256          CHAR(64) NOT NULL,                      -- detecta arquivo repetido ou corrompido
    conteudo        BYTEA NOT NULL,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT imagens_posicao_valida   CHECK (posicao BETWEEN 1 AND 5),
    CONSTRAINT imagens_tipo_aceito      CHECK (tipo_mime IN ('image/jpeg', 'image/png')),
    CONSTRAINT imagens_tamanho_valido   CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 5 * 1024 * 1024),
    CONSTRAINT imagens_tamanho_confere  CHECK (tamanho_bytes = octet_length(conteudo)),
    CONSTRAINT imagens_uma_por_posicao  UNIQUE (aluno_id, posicao)
);

-- Representação numérica de cada rosto (Etapa 4): 128 números decimais (float32) por foto.
-- É um dado biométrico: trate com o mesmo cuidado das fotos.
CREATE TABLE IF NOT EXISTS embeddings_faciais (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aluno_id        BIGINT NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    imagem_id       BIGINT NOT NULL UNIQUE REFERENCES imagens_faciais(id) ON DELETE CASCADE,
    modelo          VARCHAR(40) NOT NULL,                   -- modelo que gerou o vetor (vetores de modelos diferentes não se comparam)
    dimensao        SMALLINT NOT NULL,
    vetor           BYTEA NOT NULL,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT embeddings_tamanho_confere CHECK (octet_length(vetor) = dimensao * 4)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_aluno ON embeddings_faciais (aluno_id);
CREATE INDEX IF NOT EXISTS idx_alunos_nome ON alunos (lower(nome));

-- Atualiza "atualizado_em" automaticamente a cada alteração do aluno.
CREATE OR REPLACE FUNCTION definir_atualizado_em() RETURNS trigger AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_alunos_atualizado_em ON alunos;
CREATE TRIGGER trg_alunos_atualizado_em
    BEFORE UPDATE ON alunos
    FOR EACH ROW EXECUTE FUNCTION definir_atualizado_em();

CREATE TABLE IF NOT EXISTS registros_ponto (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aluno_id BIGINT NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
    entrada TIMESTAMPTZ NOT NULL,
    saida TIMESTAMPTZ,
    CONSTRAINT ponto_ordem_horarios CHECK (saida IS NULL OR saida >= entrada)
);
CREATE UNIQUE INDEX IF NOT EXISTS ponto_uma_entrada_aberta ON registros_ponto(aluno_id) WHERE saida IS NULL;
CREATE INDEX IF NOT EXISTS ponto_data_entrada ON registros_ponto(entrada);

-- Persistido para que atualizar a página ou alternar câmeras não duplique uma marcação.
CREATE TABLE IF NOT EXISTS controle_ponto (
    aluno_id BIGINT PRIMARY KEY REFERENCES alunos(id) ON DELETE CASCADE,
    ultima_deteccao_em TIMESTAMPTZ NOT NULL,
    confirmacoes SMALLINT NOT NULL DEFAULT 1,
    marcado_na_aparicao BOOLEAN NOT NULL DEFAULT FALSE,
    registro_id BIGINT REFERENCES registros_ponto(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS administradores (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    usuario VARCHAR(60) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessoes_admin (
    token_hash VARCHAR(64) PRIMARY KEY,
    administrador_id SMALLINT NOT NULL REFERENCES administradores(id) ON DELETE CASCADE,
    expira_em TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessoes_admin_expiracao ON sessoes_admin(expira_em);

COMMIT;
