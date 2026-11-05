# Validação presencial da Versão 1

Os testes automáticos com câmera simulada não substituem esta etapa. Preencha os resultados durante o teste com participantes autorizados.

Data: ______. Responsável: ______. Navegador do PC: ______. Modelo/navegador do celular: ______.

| Verificação | Resultado esperado | Resultado observado |
| --- | --- | --- |
| Cadastrar participante com cinco fotos | Cadastro salvo e visível na Consulta | Pendente |
| Repetir CPF | Cadastro recusado sem salvar fotos novas | Pendente |
| Cadastrar uma foto sem rosto | Recusa indicando qual foto | Pendente |
| Foto com dois rostos | Cadastro recusado | Pendente |
| Foto de outra pessoa entre as cinco | Cadastro recusado | Pendente |
| Participante cadastrado na webcam | Cartão após duas confirmações, CPF mascarado | Pendente |
| Pessoa não cadastrada na webcam | Nenhum cartão | Pendente |
| Dois participantes no quadro | Revisão necessária, nenhum cartão | Pendente |
| Participante sai do quadro | Cartão removido no próximo resultado | Pendente |
| Trocar de pessoa | Cartão anterior some antes de confirmar o novo | Pendente |
| Desligar/trocar câmera ou ocultar a aba | Cartão removido | Pendente |
| Interromper a API/rede após identificar | Cartão removido em até cerca de quatro segundos | Pendente |
| Celular acessa o QR code por HTTPS | Prévia e cartão no PC; nenhum dado cadastral no celular | Pendente |
| Parar o envio do celular | PC desconectado e cartão removido em até cerca de cinco segundos | Pendente |
| Gerar novo QR code | Cartão limpo, link anterior inválido e câmera anterior encerrada | Pendente |
| Ficar 15 minutos sem enviar | Sessão expira e exige novo QR code | Pendente |
| Reiniciar a API | Cadastros persistem, sessões do celular precisam ser recriadas | Pendente |

Use diferentes iluminações, distâncias e ângulos. Registre falhas sem anexar fotos pessoais ao repositório.
Para avaliar distâncias e possíveis confusões com mais participantes, utilize `services.calibrar` conforme o README.
Não altere os limites só para fazer uma foto de teste passar: reserve outras fotos para uma nova avaliação.

## Validação do ponto e da administração

| Verificação | Resultado esperado | Resultado observado |
| --- | --- | --- |
| Primeira passagem reconhecida | Entrada registrada, horário de chegada no cartão | Pendente |
| Permanecer diante da câmera | Uma única entrada, sem saída automática | Pendente |
| Sair por pelo menos cinco segundos e voltar | Saída registrada com chegada e duração no cartão | Pendente |
| Nova passagem após a saída | Novo registro de entrada | Pendente |
| Abrir Horários pela primeira vez | Solicita criação do administrador | Pendente |
| Acessar sem login ou com senha incorreta | Não exibe os horários | Pendente |
| Entrar como administrador | Exibe pessoa, chegada, saída e permanência | Pendente |
| Filtrar pessoa e período | Exibe registros e total correspondentes à data de entrada | Pendente |
| Sair da administração | Exige novo login para consultar | Pendente |
| Registrar pelo celular | Horários aparecem apenas no cartão do computador e na aba administrativa | Pendente |

## Validação da exclusão de cadastro

Use um cadastro fictício descartável para esta etapa.

| Verificação | Resultado esperado | Resultado observado |
| --- | --- | --- |
| Consulta → abrir aluno → Excluir cadastro | Mostra nome, confirmação e aviso sobre fotos e histórico | Pendente |
| Cancelar ou pressionar Esc | Nenhum dado removido | Pendente |
| Tentar com senha incorreta | Mostra erro e mantém o cadastro | Pendente |
| Confirmar como administrador | Remove cadastro da lista e mostra mensagem de sucesso | Pendente |
| Buscar o nome após excluir | Cadastro excluído não aparece | Pendente |
| Reconhecer o rosto excluído | Nenhum cartão daquele cadastro | Pendente |
| Verificar os horários | Registros daquela pessoa foram removidos; outros permanecem | Pendente |
