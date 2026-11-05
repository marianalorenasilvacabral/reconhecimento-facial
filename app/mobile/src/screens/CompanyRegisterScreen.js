import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { Button, HelperText, Switch, Text, TextInput } from 'react-native-paper'
import { useAuth } from '../hooks/useAuth'
import { buscarCep } from '../services/cep'
import { estilos } from '../theme'

export default function CompanyRegisterScreen() {
  const { autenticar } = useAuth()
  const [dados, setDados] = useState({ nome: '', responsavel: '', email: '', senha: '', cnpj: '', cep: '', endereco: {}, aceite: false })
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [erroCep, setErroCep] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const campo = (chave, valor) => setDados((anterior) => ({ ...anterior, [chave]: valor }))
  async function consultarCep() {
    setBuscando(true); setErroCep('')
    try { campo('endereco', await buscarCep(dados.cep)) } catch (e) { setErroCep(e.message) }
    finally { setBuscando(false) }
  }
  async function salvar() {
    setErro('')
    if (dados.nome.trim().length < 3 || dados.responsavel.trim().length < 3) { setErro('Informe o nome da empresa e do responsável.'); return }
    if (!dados.email.includes('@')) { setErro('Informe um e-mail válido.'); return }
    if (dados.senha.length < 8 || dados.senha !== confirmacao) { setErro('Use uma senha de oito caracteres ou mais e confirme a mesma senha.'); return }
    if (!dados.aceite) { setErro('Confirme a autorização para cadastrar a empresa.'); return }
    setSalvando(true)
    try { await autenticar(dados, true) } catch (e) { setErro(e.message) }
    finally { setSalvando(false) }
  }
  return <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
    <Text style={estilos.titulo}>Vamos conhecer sua empresa</Text><Text style={estilos.subtitulo}>Crie a conta do empresário. Os funcionários e pontos ficarão vinculados somente a ela.</Text>
    {[['nome', 'Nome da empresa'], ['responsavel', 'Nome do responsável'], ['email', 'E-mail de acesso'], ['cnpj', 'CNPJ (opcional)']].map(([chave, rotulo]) => <TextInput key={chave} label={rotulo} value={dados[chave]} onChangeText={(v) => campo(chave, chave === 'cnpj' ? v.replace(/\D/g, '').slice(0,14) : v)} mode="outlined" style={estilos.campo} autoCapitalize={chave === 'email' ? 'none' : 'words'} keyboardType={chave === 'email' ? 'email-address' : chave === 'cnpj' ? 'number-pad' : 'default'} />)}
    <TextInput label="Senha" value={dados.senha} onChangeText={(v) => campo('senha', v)} secureTextEntry mode="outlined" style={estilos.campo} />
    <TextInput label="Confirme a senha" value={confirmacao} onChangeText={setConfirmacao} secureTextEntry mode="outlined" style={estilos.campo} />
    <View style={[estilos.cartao, estilos.preenchimento]}><Text style={estilos.nome}>Endereço da empresa</Text>
      <TextInput label="CEP (opcional)" value={dados.cep} onChangeText={(v) => campo('cep', v.replace(/\D/g, '').slice(0,8))} keyboardType="number-pad" mode="outlined" />
      <Button onPress={consultarCep} loading={buscando} disabled={buscando || dados.cep.length !== 8}>Buscar endereço pelo CEP</Button>
      {erroCep ? <HelperText type="error" visible>{erroCep}</HelperText> : null}
      {[['logradouro','Rua'],['bairro','Bairro'],['cidade','Cidade'],['uf','UF']].map(([chave, rotulo]) => <TextInput key={chave} label={rotulo} value={dados.endereco[chave] || ''} onChangeText={(v) => campo('endereco', { ...dados.endereco, [chave]: v })} mode="outlined" maxLength={chave === 'uf' ? 2 : 200} />)}
    </View>
    <View style={estilos.linha}><Switch value={dados.aceite} onValueChange={(v) => campo('aceite', v)} accessibilityLabel="Autorizo o cadastro da empresa" /><Text style={{ flex: 1 }}>Sou responsável por esta empresa e autorizo seu cadastro.</Text></View>
    {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
    <Button mode="contained" loading={salvando} disabled={salvando} onPress={salvar} style={estilos.botao} contentStyle={{ height: 50 }}>Cadastrar empresa</Button>
  </ScrollView></KeyboardAvoidingView>
}
