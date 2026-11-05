import React, { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Button, Dialog, IconButton, Portal, Text } from 'react-native-paper'
import { useApi } from '../hooks/useApi'
import { api } from '../services/api'
import { dataCurta, duracao, mesAtual, moverMes, nomeMes } from '../utils/formatacao'
import AvatarFuncionario from '../components/AvatarFuncionario'
import QuatroHorarios from '../components/QuatroHorarios'
import Estado from '../components/Estado'
import { estilos } from '../theme'

export default function EmployeeDetailScreen({ route, navigation }) {
  const [mes, setMes] = useState(mesAtual())
  const { dados, carregando, erro, recarregar } = useApi(`/funcionarios/${route.params.id}/ponto?mes=${mes}`)
  const [confirmar, setConfirmar] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState('')
  async function excluir() {
    setExcluindo(true)
    try { await api(`/funcionarios/${route.params.id}`, { method: 'DELETE' }); navigation.goBack() }
    catch (e) { setErroExclusao(e.message) }
    finally { setExcluindo(false) }
  }
  return <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
    {dados && <View style={estilos.linha}><AvatarFuncionario funcionario={dados.funcionario} size={62} /><View style={{ flex: 1 }}><Text style={estilos.nome}>{dados.funcionario.nome}</Text><Text style={estilos.subtitulo}>{dados.funcionario.cargo || 'Funcionário'}</Text></View><IconButton icon="pencil-outline" accessibilityLabel="Editar funcionário" onPress={() => navigation.navigate('FuncionarioFormulario', { id: route.params.id })} /></View>}
    <View style={[estilos.cartao, estilos.entre]}><IconButton icon="chevron-left" accessibilityLabel="Mês anterior" onPress={() => setMes(moverMes(mes, -1))} /><Text style={[estilos.nome, { textTransform: 'capitalize' }]}>{nomeMes(mes)}</Text><IconButton icon="chevron-right" accessibilityLabel="Próximo mês" onPress={() => setMes(moverMes(mes, 1))} /></View>
    <Estado carregando={carregando} erro={erro} tentar={recarregar} />
    {dados && !carregando && <>
      <View style={[estilos.cartao, estilos.preenchimento]}><Text style={estilos.subtitulo}>TEMPO TRABALHADO NO MÊS</Text><Text style={[estilos.titulo, { fontSize: 36 }]}>{duracao(dados.totais.trabalhadoSegundos)}</Text><View style={estilos.linha}>
        <View style={{ flex: 1 }}><Text style={estilos.subtitulo}>Atrasos</Text><Text style={{ color: '#A76013', fontSize: 20, fontWeight: '700' }}>{duracao(dados.totais.atrasoSegundos)}</Text></View>
        <View style={{ flex: 1 }}><Text style={estilos.subtitulo}>Horas extras</Text><Text style={{ color: '#344AC7', fontSize: 20, fontWeight: '700' }}>{duracao(dados.totais.extraSegundos)}</Text></View>
      </View><Text style={estilos.subtitulo}>{dados.totais.diasCompletos} dias completos · {dados.totais.diasPendentes} pendentes</Text></View>
      <Text style={estilos.nome}>Registros do mês</Text>
      {dados.dias.length === 0 && <Estado vazio="Nenhuma marcação neste mês. Os horários aparecerão após o reconhecimento facial no computador." />}
      {dados.dias.map((dia) => <View key={dia.id} style={[estilos.cartao, estilos.preenchimento]}><View style={estilos.entre}><Text style={estilos.nome}>{dataCurta(dia.data)}</Text><Text style={estilos.etiqueta}>{dia.completo ? 'Completo' : 'Pendente'}</Text></View><QuatroHorarios ponto={dia} /><Text style={estilos.subtitulo}>Trabalhado: {duracao(dia.trabalhadoSegundos)} · Atraso: {duracao(dia.atrasoSegundos)} · Extra: {duracao(dia.extraSegundos)}</Text></View>)}
      <Text style={estilos.subtitulo}>Atrasos consideram chegada e retorno do almoço, conforme a jornada e a tolerância cadastradas. Extras são calculadas ao completar as quatro marcações. Fuso: Brasília.</Text>
      <Button textColor="#B3261E" onPress={() => setConfirmar(true)}>Excluir funcionário</Button>
    </>}
    <Portal><Dialog visible={confirmar} onDismiss={() => { if (!excluindo) setConfirmar(false) }}><Dialog.Title>Excluir funcionário?</Dialog.Title><Dialog.Content><Text>A exclusão remove o cadastro, as fotos e todo o histórico de ponto. Essa ação é permanente.</Text>{erroExclusao ? <Text style={estilos.erro}>{erroExclusao}</Text> : null}</Dialog.Content><Dialog.Actions><Button disabled={excluindo} onPress={() => setConfirmar(false)}>Cancelar</Button><Button textColor="#B3261E" loading={excluindo} disabled={excluindo} onPress={excluir}>Excluir definitivamente</Button></Dialog.Actions></Dialog></Portal>
  </ScrollView>
}
