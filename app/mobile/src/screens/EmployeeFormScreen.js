import React, { useEffect, useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native'
import { Button, Chip, Dialog, Icon, Portal, Switch, Text, TextInput } from 'react-native-paper'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import Estado from '../components/Estado'
import { estilos } from '../theme'

const JORNADA = { entrada: '08:00', saidaAlmoco: '12:00', retornoAlmoco: '13:00', saida: '17:00', diasSemana: [1,2,3,4,5], toleranciaMinutos: 0 }
const FOTOS = ['Frontal', 'Lado esquerdo', 'Lado direito', 'Outra expressão', 'Outra iluminação']

export default function EmployeeFormScreen({ route, navigation }) {
  const id = route.params?.id
  const { dados: existente, carregando, erro: erroBusca, recarregar } = useApi(id ? `/funcionarios/${id}` : null)
  const [dados, setDados] = useState({ nome: '', cpf: '', nascimento: '', cargo: '', ativo: true, autorizado: false, jornada: JORNADA })
  const [fotos, setFotos] = useState(Array(5).fill(null))
  const [fotoSelecionada, setFotoSelecionada] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [processandoFoto, setProcessandoFoto] = useState(false)
  useEffect(() => {
    if (existente) setDados({ ...existente, nascimento: String(existente.nascimento).slice(0,10), autorizado: true })
  }, [existente])
  const campo = (chave, valor) => setDados((anterior) => ({ ...anterior, [chave]: valor }))
  const jornada = (chave, valor) => campo('jornada', { ...dados.jornada, [chave]: valor })
  async function escolherFoto(camera) {
    const indice = fotoSelecionada
    setFotoSelecionada(null); setErro(''); setProcessandoFoto(true)
    try {
      const permissao = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permissao.granted) throw new Error('Permita o acesso à câmera ou às fotos para continuar.')
      const resultado = await (camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)({ mediaTypes: ['images'], quality: 0.6, allowsEditing: false })
      if (resultado.canceled) return
      const imagem = await ImageManipulator.manipulateAsync(resultado.assets[0].uri, [{ resize: { width: 800 } }], { compress: 0.65, format: ImageManipulator.SaveFormat.JPEG, base64: true })
      setFotos((anteriores) => anteriores.map((foto, i) => i === indice ? { uri: imagem.uri, base64: imagem.base64 } : foto))
    } catch (e) { setErro(e.message || 'Não foi possível preparar a foto.') }
    finally { setProcessandoFoto(false) }
  }
  async function salvar() {
    setErro('')
    if (dados.nome.trim().length < 3) { setErro('Informe o nome completo do funcionário.'); return }
    if (!id && (!/^\d{11}$/.test(dados.cpf) || !/^\d{4}-\d{2}-\d{2}$/.test(dados.nascimento))) { setErro('Informe CPF com 11 números e nascimento no formato AAAA-MM-DD.'); return }
    if (!id && (!dados.autorizado || fotos.some((foto) => !foto))) { setErro('Envie as cinco fotos e confirme a autorização do funcionário.'); return }
    const j = dados.jornada
    if (![j.entrada,j.saidaAlmoco,j.retornoAlmoco,j.saida].every((h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)) || !(j.entrada < j.saidaAlmoco && j.saidaAlmoco < j.retornoAlmoco && j.retornoAlmoco < j.saida) || !j.diasSemana.length) { setErro('Confira a ordem dos quatro horários e selecione os dias de trabalho.'); return }
    setSalvando(true)
    try {
      const corpo = id ? { nome: dados.nome, cargo: dados.cargo, ativo: dados.ativo, jornada: j } : { ...dados, fotos: fotos.map((foto) => foto.base64) }
      await api(id ? `/funcionarios/${id}` : '/funcionarios', { method: id ? 'PUT' : 'POST', body: corpo })
      navigation.goBack()
    } catch (e) { setErro(e.message) }
    finally { setSalvando(false) }
  }
  if (id && (carregando || erroBusca)) return <View style={[estilos.tela, estilos.conteudo]}><Estado carregando={carregando} erro={erroBusca} tentar={recarregar} /></View>
  return <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
    <Text style={estilos.titulo}>{id ? 'Editar funcionário' : 'Novo funcionário'}</Text><Text style={estilos.subtitulo}>Defina os dados e a jornada que serão usados no reconhecimento e no cálculo do ponto.</Text>
    <TextInput label="Nome completo" value={dados.nome} onChangeText={(v) => campo('nome', v)} mode="outlined" style={estilos.campo} />
    <TextInput label="Cargo" value={dados.cargo} onChangeText={(v) => campo('cargo', v)} mode="outlined" style={estilos.campo} />
    {!id && <><TextInput label="CPF (somente números)" value={dados.cpf} onChangeText={(v) => campo('cpf', v.replace(/\D/g,'').slice(0,11))} keyboardType="number-pad" mode="outlined" style={estilos.campo} />
      <TextInput label="Nascimento · AAAA-MM-DD" value={dados.nascimento} onChangeText={(v) => campo('nascimento', v)} mode="outlined" style={estilos.campo} keyboardType="numbers-and-punctuation" maxLength={10} /></>}
    <View style={[estilos.cartao, estilos.preenchimento]}><Text style={estilos.nome}>Jornada prevista</Text>
      {[['entrada','Entrada'],['saidaAlmoco','Saída para almoço'],['retornoAlmoco','Retorno do almoço'],['saida','Saída final']].map(([chave, rotulo]) => <TextInput key={chave} label={`${rotulo} · HH:MM`} value={dados.jornada[chave]} onChangeText={(v) => jornada(chave, v)} mode="outlined" keyboardType="numbers-and-punctuation" maxLength={5} />)}
      <Text style={estilos.subtitulo}>Dias de trabalho</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map((dia, i) => <Chip key={dia} selected={dados.jornada.diasSemana.includes(i + 1)} onPress={() => jornada('diasSemana', dados.jornada.diasSemana.includes(i + 1) ? dados.jornada.diasSemana.filter((v) => v !== i + 1) : [...dados.jornada.diasSemana, i + 1])}>{dia}</Chip>)}</View>
      <TextInput label="Tolerância de atraso (minutos)" value={String(dados.jornada.toleranciaMinutos)} onChangeText={(v) => jornada('toleranciaMinutos', Number(v.replace(/\D/g,'').slice(0,2)))} keyboardType="number-pad" mode="outlined" />
    </View>
    <View style={estilos.entre}><Text style={estilos.nome}>Funcionário ativo</Text><Switch accessibilityLabel="Funcionário ativo" value={dados.ativo} onValueChange={(v) => campo('ativo', v)} /></View>
    {!id && <View style={[estilos.cartao, estilos.preenchimento]}><Text style={estilos.nome}>Fotos para reconhecimento</Text><Text style={estilos.subtitulo}>Cinco fotos da mesma pessoa, com boa iluminação e apenas um rosto. Toque em cada espaço para fotografar ou enviar uma imagem.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{FOTOS.map((rotulo, i) => <Pressable key={rotulo} onPress={() => setFotoSelecionada(i)} disabled={processandoFoto || salvando} accessibilityRole="button" accessibilityLabel={`Selecionar foto ${i + 1}: ${rotulo}`} style={{ width: '30%', minWidth: 80, alignItems: 'center', gap: 6 }}>
        <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#EEF1FA', borderRadius: 14, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>{fotos[i] ? <Image source={{ uri: fotos[i].uri }} style={{ width: '100%', height: '100%' }} /> : <Icon source="camera-plus-outline" size={30} color="#67758B" />}</View><Text style={{ fontSize: 11 }}>{i + 1}. {rotulo}</Text>
      </Pressable>)}</View>
      {processandoFoto && <Text>Preparando foto…</Text>}
      <View style={estilos.linha}><Switch accessibilityLabel="Funcionário autorizou as fotos" value={dados.autorizado} onValueChange={(v) => campo('autorizado', v)} /><Text style={{ flex: 1 }}>O funcionário foi informado e autorizou o uso das fotos para reconhecimento facial.</Text></View>
    </View>}
    {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
    <Button mode="contained" loading={salvando} disabled={salvando || processandoFoto} onPress={salvar} style={estilos.botao} contentStyle={{ height: 50 }}>{id ? 'Salvar alterações' : 'Cadastrar funcionário'}</Button>
    {salvando && <Text style={estilos.subtitulo}>Validando os dados e, no cadastro, as cinco fotos com o reconhecimento facial…</Text>}
    <Portal><Dialog visible={fotoSelecionada !== null} onDismiss={() => setFotoSelecionada(null)}><Dialog.Title>Foto {Number(fotoSelecionada) + 1}</Dialog.Title><Dialog.Content><Button icon="camera-outline" onPress={() => escolherFoto(true)}>Tirar foto com a câmera</Button><Button icon="image-outline" onPress={() => escolherFoto(false)}>Escolher da galeria</Button></Dialog.Content><Dialog.Actions><Button onPress={() => setFotoSelecionada(null)}>Cancelar</Button></Dialog.Actions></Dialog></Portal>
  </ScrollView></KeyboardAvoidingView>
}
