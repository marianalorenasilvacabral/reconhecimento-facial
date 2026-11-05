# Verificação da entrega — 26/10/2026

Ambiente: Windows, Python 3.11, Node.js 20, PostgreSQL 18 e Google Chrome.
As versões Python utilizadas estão em `backend/requirements.lock.txt` e as JavaScript em `frontend/package-lock.json`.

| Comando | Resultado |
| --- | --- |
| `backend/.venv/Scripts/python.exe -m pytest tests -q` | 105 aprovados, 10 pulados |
| `npm.cmd test` no frontend | Regras do cartão aprovadas |
| `npm.cmd run build` no frontend | Compilação concluída |
| `npm.cmd run test:e2e` no frontend | 3 testes de navegador aprovados |

Essa rodada de testes usou dois bancos exclusivos de uma instância local separada, na porta 55432.
Nessa rodada não foi acessado o banco anterior de cadastros. O script de inicialização dos bancos de testes também foi executado.

Os três cenários do navegador verificaram:

1. Cartão confirmado, CPF mascarado, remoção em dúvida, rosto desconhecido, ausência de rosto, falha de rede e falta de resultados novos.
2. Cadastro de cinco imagens pela interface, gravação no PostgreSQL, consulta e identificação pela webcam simulada.
3. Vídeo enviado pela página HTTPS do celular através do proxy real, cartão no computador, ausência de dados pessoais no celular,
   bloqueio de consulta de alunos pelo proxy, parada, reconexão e invalidação do QR code anterior com encerramento da câmera.

Esses testes de navegador usam um reconhecedor falso, restrito ao servidor de testes. A API normal continua usando dlib.
O modelo dlib real foi carregado e testado com imagem sem rosto, sem uso de fotos pessoais.
Os dez testes pulados requerem as fotos indicadas em `PASTA_ROSTOS_TESTE`; eles não comprovam reconhecimento de participantes nesta entrega.

## Continuação com o banco configurado e dlib real

A conexão com o banco `reconhecimento` foi confirmada. A tabela `embeddings_faciais` foi criada,
a geração de novas matrículas foi atualizada e os vetores do cadastro antigo foram gerados a partir das fotos já salvas.
A API normal e as interfaces foram iniciadas nas portas 8000, 5173 e 5174.

Um teste adicional em Chrome sem janela utilizou uma foto já cadastrada como fonte de uma câmera simulada,
passando pela API normal com dlib real e PostgreSQL, sem substituir o reconhecedor:

- A foto foi identificada como o cadastro correspondente.
- O cartão confirmou o aluno e manteve o CPF mascarado.
- Ao trocar a imagem por um quadro sem rosto, o cartão foi removido.
- Ao retornar o rosto, o cartão foi confirmado novamente.
- Ao desligar a câmera, o cartão foi removido.

O mesmo teste foi feito pela página HTTPS do modo celular, com o proxy normal:

- Os quadros enviados pela página do celular foram reconhecidos pelo dlib real e o cartão apareceu no computador.
- O celular recebeu somente o estado do reconhecimento, sem os dados cadastrais.
- A consulta de alunos pelo proxy do celular recebeu 404.
- Ao parar o envio, o computador indicou desconexão e removeu o cartão.

Essas verificações reutilizaram uma foto do próprio cadastro e câmeras simuladas no computador.
Elas confirmam a integração em execução, mas não medem reconhecimento de fotos inéditas nem compatibilidade de um celular físico.
Não foram criados alunos nem substituídas fotos durante esses testes adicionais.

Pendências de validação externa: calibração com participantes, testes com fotos inéditas e teste em celular físico na rede Wi-Fi.
Use [o roteiro presencial](VALIDACAO.md) para registrar esses resultados.

## Atualização: entrada, saída e administração

A nova implementação passou por **123 testes de backend**, com os mesmos dez testes de fotos externas pulados.
Os dois conjuntos de utilidades JavaScript passaram e a interface foi compilada.
Os **quatro testes de navegador** passaram, incluindo a nova jornada completa de ponto e administração.

Foram verificados:

- Duas confirmações para marcar entrada; quadros repetidos não alternam automaticamente para saída.
- Nova passagem após pelo menos cinco segundos sem reconhecimento marca a saída, com duração calculada pelo servidor.
- Novo ciclo após uma saída e encerramento de uma entrada no dia seguinte.
- Requisições simultâneas e clientes diferentes produzem uma única marcação por aparição.
- Marcações pelo celular não enviam horários ou dados pessoais ao aparelho.
- Criação do primeiro administrador, senha com hash, cookie HttpOnly, login, logout e expiração de sessão.
- Recusa de senhas incorretas, limitação de tentativas, acesso remoto e origem externa.
- Bloqueio dos horários sem autenticação, filtros por nome e datas no fuso de Brasília, paginação e total de permanência.
- Cartão com chegada na entrada e chegada, saída e permanência na saída.

Durante a validação foi corrigida uma disputa na abertura da câmera no StrictMode do React;
o efeito cancelado não chega a solicitar uma nova câmera enquanto a anterior é liberada.

Os testes que criam pessoas, administradores e marcações usaram exclusivamente os bancos de teste.
No banco atual, a migração criou as tabelas novas e confirmou a preservação das quantidades de alunos, fotos e vetores.
Nenhuma senha administrativa padrão foi cadastrada: o usuário deve criar o administrador na primeira visita à aba Horários.
