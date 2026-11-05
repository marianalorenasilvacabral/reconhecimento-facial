import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { Button, Dialog, HelperText, Icon, Portal, Text, TextInput } from 'react-native-paper'
import { useAuth } from '../hooks/useAuth'
import { estilos } from '../theme'

export default function LoginScreen({ navigation }) {
  const { autenticar, url, salvarEndereco } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [configurando, setConfigurando] = useState(false)
  const [endereco, setEndereco] = useState(url)
  async function entrar() {
    if (!email.trim() || !senha) { setErro('Informe seu e-mail e sua senha.'); return }
    setEnviando(true); setErro('')
    try { await autenticar({ email: email.trim(), senha }); setSenha('') }
    catch (e) { setErro(e.message) }
    finally { setEnviando(false) }
  }
  async function configurar() {
    try { await salvarEndereco(endereco); setConfigurando(false); setErro('') }
    catch (e) { setErro(e.message) }
  }
  return <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={[estilos.conteudo, { justifyContent: 'center', paddingVertical: 40 }]} keyboardShouldPersistTaps="handled">
      <View style={[estilos.linha, { marginBottom: 30 }]}><Icon source="clock-check-outline" size={36} color="#344AC7" /><Text style={[estilos.nome, { fontSize: 22 }]}>Ponto Empresa</Text></View>
      <Text style={[estilos.titulo, { fontSize: 35 }]}>Seu time. Cada{ '\n' }minuto em dia.</Text>
      <Text style={estilos.subtitulo}>Entradas, almoço e saídas em um só lugar. Acompanhe a jornada da sua equipe pelo celular.</Text>
      <View style={[estilos.cartao, estilos.preenchimento, { marginTop: 12, gap: 16 }]}>
        <Text variant="titleLarge" style={{ fontWeight: '700' }}>Entrar na empresa</Text>
        <TextInput label="E-mail" mode="outlined" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" style={estilos.campo} disabled={enviando} />
        <TextInput label="Senha" mode="outlined" value={senha} onChangeText={setSenha} secureTextEntry autoComplete="current-password" style={estilos.campo} disabled={enviando} onSubmitEditing={entrar} />
        {erro ? <HelperText type="error" visible accessibilityRole="alert">{erro}</HelperText> : null}
        <Button mode="contained" onPress={entrar} loading={enviando} disabled={enviando} style={estilos.botao} contentStyle={{ height: 50 }}>Entrar</Button>
        <Button onPress={() => navigation.navigate('CadastroEmpresa')} disabled={enviando}>Ainda não tenho conta · Cadastrar empresa</Button>
      </View>
      <Button icon="cog-outline" textColor="#67758B" onPress={() => { setEndereco(url); setConfigurando(true) }}>Configurar conexão</Button>
    </ScrollView>
    <Portal><Dialog visible={configurando} onDismiss={() => setConfigurando(false)}><Dialog.Title>Conexão com o computador</Dialog.Title><Dialog.Content>
      <Text style={estilos.subtitulo}>Use o IPv4 do computador na mesma rede Wi-Fi, seguido da porta 3001.</Text>
      <TextInput label="Endereço da API" value={endereco} onChangeText={setEndereco} autoCapitalize="none" autoCorrect={false} mode="outlined" style={{ marginTop: 12 }} />
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
    </Dialog.Content><Dialog.Actions><Button onPress={() => setConfigurando(false)}>Cancelar</Button><Button onPress={configurar}>Salvar conexão</Button></Dialog.Actions></Dialog></Portal>
  </KeyboardAvoidingView>
}
