import { StyleSheet } from 'react-native'
import { MD3LightTheme } from 'react-native-paper'

export const cores = { fundo: '#F3F5FA', tinta: '#152139', suave: '#67758B', primaria: '#344AC7', verde: '#167659', borda: '#E3E8F1' }
export const tema = { ...MD3LightTheme, roundness: 5, colors: { ...MD3LightTheme.colors, primary: cores.primaria, secondary: cores.verde, background: cores.fundo, surface: '#FFFFFF', surfaceVariant: '#E9EDF9', onSurface: cores.tinta, outline: '#8E9AB0' } }
export const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo }, conteudo: { padding: 20, gap: 18, width: '100%', maxWidth: 720, alignSelf: 'center', flexGrow: 1 },
  titulo: { fontSize: 27, fontWeight: '800', color: cores.tinta, letterSpacing: -0.6 }, subtitulo: { color: cores.suave, fontSize: 14, lineHeight: 21 },
  cartao: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: cores.borda }, preenchimento: { padding: 18, gap: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 }, entre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  campo: { backgroundColor: '#FFF' }, erro: { color: '#B3261E', lineHeight: 21 }, botao: { borderRadius: 12 },
  nome: { fontSize: 17, fontWeight: '700', color: cores.tinta }, etiqueta: { backgroundColor: '#E7F4EF', color: cores.verde, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, fontSize: 12, fontWeight: '600' },
})
