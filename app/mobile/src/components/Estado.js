import React from 'react'
import { View } from 'react-native'
import { ActivityIndicator, Button, Text } from 'react-native-paper'
import { estilos } from '../theme'

export default function Estado({ carregando, erro, tentar, vazio }) {
  if (carregando) return <View style={{ padding: 30, gap: 12 }}><ActivityIndicator /><Text style={{ textAlign: 'center' }}>Carregando informações…</Text></View>
  if (erro) return <View style={[estilos.cartao, estilos.preenchimento]}><Text style={estilos.erro}>{erro}</Text><Button onPress={tentar}>Tentar novamente</Button></View>
  if (vazio) return <View style={[estilos.cartao, estilos.preenchimento]}><Text style={estilos.subtitulo}>{vazio}</Text></View>
  return null
}
