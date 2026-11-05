import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'
import { hora } from '../utils/formatacao'
import { cores } from '../theme'

export default function QuatroHorarios({ ponto }) {
  return <View style={styles.linha}>{[['entrada', 'Entrada'], ['saida_almoco', 'Almoço'], ['retorno_almoco', 'Retorno'], ['saida', 'Saída']].map(([chave, rotulo]) => <View key={chave} style={styles.item}>
    <Text style={styles.rotulo}>{rotulo}</Text><Text style={[styles.valor, ponto?.[chave] && { color: cores.primaria }]}>{hora(ponto?.[chave])}</Text>
  </View>)}</View>
}
const styles = StyleSheet.create({ linha: { flexDirection: 'row', gap: 6 }, item: { flex: 1, backgroundColor: '#F4F6FB', paddingVertical: 10, borderRadius: 10, alignItems: 'center' }, rotulo: { fontSize: 11, color: cores.suave, marginBottom: 4 }, valor: { fontSize: 15, fontWeight: '700', color: '#8E99AC' } })
