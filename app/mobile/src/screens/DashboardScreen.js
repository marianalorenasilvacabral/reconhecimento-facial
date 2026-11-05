import React from 'react'
import { ScrollView, View, RefreshControl } from 'react-native'
import { Button, Card, Icon, Text } from 'react-native-paper'
import { useAuth } from '../hooks/useAuth'
import { useApi } from '../hooks/useApi'
import Estado from '../components/Estado'
import { estilos } from '../theme'

export default function DashboardScreen({ navigation }) {
  const { empresa } = useAuth()
  const { dados, carregando, erro, recarregar } = useApi('/empresa')
  return <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo} refreshControl={<RefreshControl refreshing={carregando && Boolean(dados)} onRefresh={recarregar} />}>
    <Text style={estilos.subtitulo}>BEM-VINDO AO SEU PAINEL</Text><Text style={estilos.titulo}>{dados?.empresa.nome || empresa.nome}</Text>
    <Text style={estilos.subtitulo}>Uma visão clara da jornada de quem faz sua empresa acontecer.</Text>
    <Card mode="contained" style={{ backgroundColor: '#344AC7', borderRadius: 22 }} onPress={() => navigation.navigate('Funcionarios')} accessibilityLabel="Ver funcionários cadastrados">
      <Card.Content style={{ gap: 14, paddingVertical: 25 }}>
        <View style={estilos.entre}><Text style={{ color: '#DCE2FF', fontSize: 15 }}>Funcionários cadastrados</Text><Icon source="account-group-outline" size={28} color="#FFF" /></View>
        <Text style={{ color: '#FFF', fontSize: 52, fontWeight: '800' }}>{dados?.resumo.total ?? '—'}</Text>
        <View style={estilos.entre}><Text style={{ color: '#E6E9FF' }}>Ver minha equipe</Text><Icon source="arrow-right" size={22} color="#FFF" /></View>
      </Card.Content>
    </Card>
    <View style={estilos.linha}>{[['Ativos', dados?.resumo.ativos], ['No local hoje', dados?.resumo.no_local]].map(([rotulo, valor]) => <View key={rotulo} style={[estilos.cartao, estilos.preenchimento, { flex: 1 }]}><Text style={estilos.subtitulo}>{rotulo}</Text><Text style={[estilos.titulo, { fontSize: 30 }]}>{valor ?? '—'}</Text></View>)}</View>
    <Estado carregando={carregando && !dados} erro={erro} tentar={recarregar} />
    <Button mode="contained" icon="account-plus-outline" onPress={() => navigation.navigate('FuncionarioFormulario')} style={estilos.botao} contentStyle={{ height: 50 }}>Cadastrar funcionário</Button>
    <View style={[estilos.cartao, estilos.preenchimento]}><Icon source="face-recognition" size={30} color="#344AC7" /><Text style={estilos.nome}>O reconhecimento cuida do registro</Text><Text style={estilos.subtitulo}>A câmera do computador registra entrada, saída para almoço, retorno e saída final. Consulte aqui os horários e o cálculo mensal.</Text></View>
  </ScrollView>
}
