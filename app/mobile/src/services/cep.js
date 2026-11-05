export async function buscarCep(valor) {
  const cep = valor.replace(/\D/g, '')
  if (cep.length !== 8) throw new Error('Digite os oito números do CEP.')
  const controle = new AbortController()
  const temporizador = setTimeout(() => controle.abort(), 10000)
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controle.signal })
    if (!resposta.ok) throw new Error('Consulta de CEP indisponível. Tente novamente.')
    const dados = await resposta.json()
    if (dados.erro) throw new Error('CEP não encontrado.')
    return { logradouro: dados.logradouro, bairro: dados.bairro, cidade: dados.localidade, uf: dados.uf }
  } catch (erro) {
    if (erro.name === 'AbortError' || erro instanceof TypeError) throw new Error('Sem conexão com o ViaCEP. Tente novamente ou informe o endereço manualmente.')
    throw erro
  } finally { clearTimeout(temporizador) }
}
