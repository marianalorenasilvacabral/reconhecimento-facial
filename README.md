# Reconhecimento de alunos — identificação e ponto

Protótipo acadêmico: identifica um aluno pela câmera e mostra seu cartão, sem digitar nome ou CPF.
Use dados fictícios ou de participantes informados que autorizaram o teste.

## Funcionalidades entregues

- Cadastro com nome, nascimento, CPF, autorização e cinco fotos JPG/PNG de até 5 MB.
- Validação de CPF, duplicidade e datas; cada foto deve conter um único rosto e as cinco devem ser da mesma pessoa.
- PostgreSQL com alunos, fotos e vetores faciais (embeddings). O cadastro é salvo em uma única transação.
- Consulta por nome com fotos e CPF mascarado.
- Reconhecimento com dlib: identificado, não identificado, revisão necessária ou sem rosto.
- Cartão após **duas confirmações consecutivas** do mesmo aluno. Dúvida, outro rosto ou ausência de rosto removem o cartão imediatamente.
- Falha de rede, troca de câmera, ocultação da aba ou quatro segundos sem resultado novo limpam o cartão; é preciso confirmar novamente.
- Webcam do computador, webcam virtual e celular pelo navegador com QR code e HTTPS.
- Sessões do celular expiram após 15 minutos sem envio. O celular recebe apenas o estado do reconhecimento.
- Registro automático de entrada e saída no PostgreSQL, com cálculo da permanência e horários no cartão.
- Aba **Horários** protegida por login do administrador, com busca por nome, filtro por período, paginação e total do tempo no filtro.

Edição de cadastros, múltiplos perfis administrativos e ajustes manuais de ponto ficam para versões futuras.

## Excluir um cadastro

Na aba **Consulta**, abra o aluno e clique em **Excluir cadastro**.
A confirmação informa o nome da pessoa e os dados que serão removidos. **Cancelar** mantém o cadastro.
Se não houver sessão administrativa ativa, informe o usuário e a senha do administrador na própria confirmação.
Se o administrador ainda não foi criado, use a aba **Horários** para configurá-lo e depois retorne à Consulta.

A exclusão é permanente e remove, em uma única transação, o cadastro, as cinco fotos, os vetores faciais,
o controle de marcação e todo o histórico de entrada e saída daquela pessoa.
Outros cadastros são preservados. Após excluir, a lista é atualizada e o rosto deixa de ser reconhecido.
O CPF pode ser usado em um novo cadastro, que receberá outro identificador e matrícula.

A rota `DELETE /admin/alunos/{id}` também exige sessão de administrador e acesso local;
o botão não contorna a autenticação da API. Cartões e imagens daquele cadastro são descartados das sessões do celular.

## Entrada, saída e acesso do administrador

1. Abra **Identificação** e ligue a webcam ou o modo celular.
2. Duas confirmações do aluno registram a **entrada**. O cartão mostra o horário de chegada.
3. Quadros contínuos da mesma pessoa mantêm essa marcação, sem registrar saída repetidamente.
4. Para uma nova passagem, a pessoa deve ficar **pelo menos cinco segundos sem ser reconhecida** e voltar.
5. Duas confirmações na nova passagem registram a **saída**, mostrando chegada, saída e tempo no local.
6. Na passagem seguinte, começa outro par de entrada e saída. Uma entrada em aberto pode ser encerrada no dia seguinte.

O controle contra duplicidade fica no banco e vale entre câmeras, atualizações da página e reinicializações da API.
Uma interrupção longa da câmera ou da API também pode iniciar uma nova passagem ao voltar a reconhecer a pessoa.
Horários são gerados pelo servidor, armazenados com fuso e exibidos em **America/Sao_Paulo**.
Registros em aberto mostram a duração até a última atualização; o total soma todos os registros correspondentes ao filtro.
Os filtros de período usam a data de **entrada**, inclusive em permanências que atravessam a meia-noite.

Na primeira visita à aba **Horários**, escolha um usuário e uma senha de pelo menos oito caracteres em **Criar administrador**.
Não há senha padrão. Essa senha é independente da senha do PostgreSQL.
Depois, a tela pedirá login; use **Sair da administração** para encerrar o acesso.
A sessão dura até oito horas. A API também exige autenticação para consultar horários;
a senha é guardada como hash com scrypt e a sessão usa cookie HttpOnly.
Após cinco tentativas de login sem sucesso, novas tentativas ficam bloqueadas por até 15 minutos.
A sessão administrativa não libera consultas pela página do celular: seu proxy continua restrito ao envio de quadros.

Para atualizar uma instalação existente, pare a API e execute a tarefa **Banco: criar ou atualizar tabelas** antes de iniciá-la novamente.
A atualização cria as tabelas de ponto e administração sem apagar alunos, fotos ou vetores.
Não são inventadas marcações para reconhecimentos anteriores: o histórico começa com os novos reconhecimentos.

## Validação e limites

Os testes de navegador exercitam React → FastAPI → PostgreSQL, com câmera e modelo facial simulados.
Cobrem cadastro, consulta, cartão, resultados incertos, perda de conexão, envio HTTPS pelo celular,
troca do QR code e bloqueio das rotas de dados no proxy do celular.
Os testes de backend cobrem regras, banco, API e expiração das sessões. Há também teste de carregamento do dlib real sem fotos pessoais.

Após configurar o banco local, a integração também foi verificada com dlib real usando uma foto já cadastrada
como câmera simulada: o cartão confirmou, desapareceu sem rosto e funcionou pelo proxy HTTPS do celular.
Essa verificação reutiliza uma foto conhecida; não mede a precisão com fotos inéditas nem substitui o teste em celular físico.

**Ainda depende dos seus participantes:** executar os testes com fotos reais, calibrar os limites e testar em um celular físico na sua rede Wi-Fi.
Passar no teste simulado não mede a precisão do reconhecimento nem garante compatibilidade com todos os celulares.
O sistema não tem detecção de vivacidade: uma foto ou tela com um rosto pode ser reconhecida. Ele não deve ser usado como controle de acesso físico.

## Abrir no VS Code

Abra a pasta que contém `backend`, `frontend`, `tests` e este README.
Em **Terminal → Executar Tarefa**, estão disponíveis as tarefas de API, frontend, HTTPS do celular, banco e testes.
As tarefas estão configuradas para Windows; os comandos abaixo também podem ser usados nos terminais do VS Code.

## Preparar o ambiente no Windows

Requisitos: Python 3.11, Node.js 20 e PostgreSQL 14 ou superior. Esta entrega foi validada com Python 3.11 e PostgreSQL 18.
Execute os comandos a partir da raiz do projeto, salvo indicação diferente.

```powershell
python -m venv backend/.venv
./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.lock.txt
cd frontend
npm.cmd ci
cd ..
```

Se `.venv` já existir, use-a diretamente. `requirements.lock.txt` registra as versões validadas;
`requirements.txt` lista as dependências diretas para manutenção.
Não é preciso ativar a `.venv` nem mudar a política de execução do PowerShell.

### Banco de cadastros

Copie `.env.example` para `.env` **apenas se ainda não tiver um `.env`**:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Preencha `DATABASE_URL` com sua conexão real do PostgreSQL. Exemplo de formato:

```dotenv
DATABASE_URL=postgresql+psycopg://usuario:senha@localhost:5432/reconhecimento
```

Use um banco já criado. Caracteres especiais na senha precisam ser codificados na URL.
A configuração também aceita `backend/.env`; uma variável do ambiente ou da raiz tem precedência.
Mantenha senhas fora do repositório.

Se preferir um PostgreSQL novo com Docker, `docker compose up -d` cria o banco da `.env.example`.
O Compose usa os valores definidos em `docker-compose.yml`; alterar a URL não altera a senha do container.
Se já houver PostgreSQL na porta 5432, utilize o banco existente ou ajuste as portas.

Para criar/atualizar as tabelas:

```powershell
cd backend
./.venv/Scripts/python.exe -m database.criar_tabelas
cd ..
```

Esse comando mantém os cadastros existentes, adiciona as tabelas que faltam e corrige a geração
de novas matrículas acima de 999. Matrículas já atribuídas não são alteradas.
Alunos antigos sem embeddings podem ser atualizados sem recadastro:

```powershell
cd backend
./.venv/Scripts/python.exe -m services.gerar_embeddings
cd ..
```

O script lista fotos inadequadas; somente alunos cujas cinco fotos passam na validação recebem os vetores.

## Iniciar o sistema

Terminal 1, na pasta `backend`:

```powershell
./.venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --no-proxy-headers
```

Terminal 2, na pasta `frontend`:

```powershell
npm.cmd run dev
```

Abra **http://127.0.0.1:5173**. API: http://127.0.0.1:8000/docs.
`GET /saude` confirma que o processo da API está no ar; não testa banco ou precisão facial.
`frontend/.env` já usa `VITE_MODO_DEMO=false`: o cadastro será salvo na API.
Se ativar o modo demo, o cadastro será apenas simulado e a consulta ficará indisponível.
Reinicie o frontend após mudar suas variáveis de ambiente.

### Celular como câmera

Opção 1: um app de webcam virtual aparece na lista de câmeras do computador.

Opção 2: mantenha os dois terminais acima e abra um terceiro na pasta `frontend`:

```powershell
npm.cmd run dev:celular
```

1. No computador, abra **Identificação → Usar o celular como câmera**.
2. Conecte os dois aparelhos na mesma rede Wi-Fi.
3. Confira o IPv4 do computador no campo do QR code. Redes de convidados podem bloquear comunicação entre aparelhos.
4. Abra o QR code no celular. O endereço deve começar com `https://` e usar a porta `5174`.
5. O certificado é local e autoassinado. Confira o endereço antes de prosseguir no aviso do navegador.
6. Permita o uso da câmera e toque em **Iniciar**. O cartão aparece no computador.
7. Ao parar ou perder a conexão, o cartão desaparece em até cerca de cinco segundos. Um novo QR code invalida o anterior.

Se o firewall solicitar liberação, limite-a à rede privada e à porta 5174. A API continua apenas em 127.0.0.1:8000.
O proxy HTTPS permite somente `POST /api/celular/<token>/quadro`; as demais rotas da API recebem 404.
No celular, `VITE_API_URL=/api` vem de `.env.celular`. Abra a interface do computador pela porta 5173.
Use **um processo da API**: sessões e últimos quadros são mantidos na memória desse processo.

## Testes

No Windows com PostgreSQL instalado em `C:\Program Files\PostgreSQL`, a tarefa **Banco de testes: iniciar** do VS Code
prepara uma instância exclusiva em `127.0.0.1:55432`, cria os dois bancos abaixo e um `.env.test` se não existir.
Ela não utiliza a instância dos seus cadastros. Use **Banco de testes: parar** ao terminar.
Esse banco local usa autenticação confiável e é exclusivo para dados fictícios dos testes.
Alternativamente, prepare seus próprios bancos conforme as instruções a seguir.

Crie **dois bancos vazios e exclusivos**, por exemplo `reconhecimento_teste` e `reconhecimento_navegador_teste`.
Copie `.env.test.example` para `.env.test` e preencha as duas URLs. Os nomes precisam terminar em `_teste` ou `_test`.
**Esses testes esvaziam seus bancos de teste. Nunca aponte para os cadastros.**
O pytest só usa `TEST_DATABASE_URL`; o navegador exige `BROWSER_TEST_DATABASE_URL` diferente.
Sem a URL de testes, o pytest pula testes que usam banco, mesmo se `DATABASE_URL` estiver configurada.

```powershell
# Raiz do projeto: backend, banco e modelo
./backend/.venv/Scripts/python.exe -m pytest tests -q

# Frontend: regra do cartão, compilação e navegador
cd frontend
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
```

Os testes de navegador usam Google Chrome instalado, portas 15173, 15174 e 18000 e câmera falsa.
Eles sobem e encerram os próprios servidores. As portas precisam estar livres.
O reconhecedor falso está restrito ao servidor em `tests/servidor_navegador.py`; a API normal usa dlib.
Não execute esse servidor de teste para uma apresentação do reconhecimento real.

Para os testes com fotos de participantes autorizados, veja o cabeçalho de `tests/test_reconhecimento_real.py`.
Configure `PASTA_ROSTOS_TESTE` com `pessoa_a1.jpg`, `pessoa_a2.jpg`, `pessoa_a3.jpg` e `pessoa_b1.jpg`.
Sem essas fotos, os dez testes reais são pulados.

## Calibrar com os participantes

Os limites da `.env.example` são pontos de partida. Separe fotos de cadastro e fotos inéditas:

```text
avaliacao/
  participante_01/
    cadastro/   (exatamente 5 fotos)
    teste/      (fotos inéditas da mesma pessoa)
  participante_02/
    cadastro/   (exatamente 5 fotos)
    teste/      (fotos inéditas da mesma pessoa)
  desconhecidos/ (fotos de outras pessoas autorizadas, ausentes do cadastro)
```

Use identificadores fictícios nas pastas. De `backend`, execute:

```powershell
./.venv/Scripts/python.exe -m services.calibrar --pasta C:/caminho/avaliacao --saida C:/caminho/relatorio.json
```

O script não acessa o banco nem altera limites. Produz distâncias, margem para o segundo candidato,
falsas aceitações, identificações incorretas, revisões e não reconhecidos.
Revise o relatório antes de ajustar `LIMITE_DISTANCIA`, `FAIXA_INCERTA`, `MARGEM_AMBIGUIDADE`,
`LIMITE_CONSISTENCIA` e `LADO_MIN_ROSTO` no `.env`. Reinicie a API e reavalie com fotos novas.
Inclua variações de iluminação, óculos, distância e posição; não conclua precisão com apenas duas pessoas.

## Dados e privacidade do protótipo

O login administrativo protege a consulta dos horários. As rotas de cadastro, consulta de alunos, fotos e identificação
continuam locais, sem login, e recusam cabeçalhos de encaminhamento. O bloqueio local não substitui autenticação nesses recursos.
CPF e imagens ficam no PostgreSQL; o CPF sai mascarado nas consultas e no cartão.
Os últimos quadros do celular ficam somente na memória, são substituídos e somem ao encerrar/expirar a sessão.
Ao desconectar, resultados e imagens antigos deixam de ser servidos ao computador.

Para uso real em escola, será necessário um projeto específico de acesso, proteção e exclusão de dados,
além da avaliação de base legal e de uma alternativa ao reconhecimento. Esta versão é acadêmica.

O ZIP/código não contém os cadastros do PostgreSQL. Para transferir cadastros entre computadores,
faça um backup separado do banco. Não envie `.env`, `.venv`, `node_modules` ou fotos de participantes junto ao código.

Veja também [o roteiro de validação presencial](docs/VALIDACAO.md).
Os resultados desta entrega estão em [RESULTADOS_TESTES.md](docs/RESULTADOS_TESTES.md).
