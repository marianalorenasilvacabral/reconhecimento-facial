import React from 'react'
import { ScrollView, View } from 'react-native'
import { Button, Icon, Text } from 'react-native-paper'
import { useAuth } from '../hooks/useAuth'
import { estilos } from '../theme'

export default function ProfileScreen() {
  const { empresa, sair } = useAuth()
  return <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}><Icon source="office-building-outline" size={48} color="#344AC7" /><Text style={estilos.titulo}>{empresa.nome}</Text><Text style={estilos.subtitulo}>A conta que conecta sua empresa à jornada da equipe.</Text>
    <View style={[estilos.cartao, estilos.preenchimento]}>{[['Responsável', empresa.responsavel], ['E-mail', empresa.email], ['CNPJ', empresa.cnpj || 'Não informado'], ['Cidade', [empresa.endereco?.cidade, empresa.endereco?.uf].filter(Boolean).join(' / ') || 'Não informada']].map(([rotulo, valor]) => <View key={rotulo} style={{ gap: 4 }}><Text style={estilos.subtitulo}>{rotulo}</Text><Text style={estilos.nome}>{valor}</Text></View>)}</View>
    <Text style={estilos.subtitulo}>Os registros chegam pelo reconhecimento facial do computador. A sessão é mantida neste dispositivo até sair ou expirar.</Text>
    <Button mode="outlined" icon="logout" onPress={sair}>Sair da conta</Button>
  </ScrollView>
}
