import React, { useEffect, useState } from 'react'
import { FlatList, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Button, Card, FAB, Menu, Searchbar, Text } from 'react-native-paper'
import { useApi } from '../hooks/useApi'
import Estado from '../components/Estado'
import AvatarFuncionario from '../components/AvatarFuncionario'
import QuatroHorarios from '../components/QuatroHorarios'
import { estilos } from '../theme'

const ordens = { nome: 'Nome · A a Z', nome_desc: 'Nome · Z a A', cargo: 'Cargo', recentes: 'Mais recentes' }

export default function EmployeesScreen({ navigation }) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('')
  const [ordem, setOrdem] = useState('nome')
  const [menu, setMenu] = useState(false)
  const { dados, carregando, erro, recarregar } = useApi(`/funcionarios?ordem=${ordem}&nome=${encodeURIComponent(filtro)}`)
  useEffect(() => { AsyncStorage.getItem('@pontoempresa/ordem').then((valor) => { if (ordens[valor]) setOrdem(valor) }).catch(() => {}) }, [])
  useEffect(() => { const espera = setTimeout(() => setFiltro(busca.trim()), 250); return () => clearTimeout(espera) }, [busca])
  function ordenar(valor) { setOrdem(valor); setMenu(false); AsyncStorage.setItem('@pontoempresa/ordem', valor).catch(() => {}) }
  return <View style={estilos.tela}>
    <FlatList data={dados || []} keyExtractor={(item) => String(item.id)} contentContainerStyle={[estilos.conteudo, { paddingBottom: 110 }]}
      refreshing={carregando && Boolean(dados)} onRefresh={recarregar}
      ListHeaderComponent={<View style={{ gap: 16, marginBottom: 18 }}><Text style={estilos.titulo}>Sua equipe</Text><Text style={estilos.subtitulo}>Toque em uma pessoa para consultar seu ponto do mês.</Text>
        <Searchbar placeholder="Buscar funcionário" value={busca} onChangeText={setBusca} accessibilityLabel="Buscar funcionário" style={{ backgroundColor: '#FFF' }} />
        <View style={estilos.entre}><Text style={estilos.subtitulo}>{dados?.length ?? 0} encontrados</Text><Menu visible={menu} onDismiss={() => setMenu(false)} anchor={<Button icon="sort-variant" onPress={() => setMenu(true)}>{ordens[ordem]}</Button>}>{Object.entries(ordens).map(([valor, rotulo]) => <Menu.Item key={valor} title={rotulo} onPress={() => ordenar(valor)} />)}</Menu></View>
        <Estado carregando={carregando && !dados} erro={erro} tentar={recarregar} />
      </View>}
      ListEmptyComponent={!carregando && !erro ? <Estado vazio={filtro ? 'Nenhum funcionário encontrado com esse nome.' : 'Sua equipe começa aqui. Cadastre o primeiro funcionário no botão abaixo.'} /> : null}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      renderItem={({ item }) => <Card style={estilos.cartao} mode="contained" onPress={() => navigation.navigate('FuncionarioDetalhe', { id: item.id, nome: item.nome })} accessibilityLabel={`Ver ponto de ${item.nome}`}>
        <Card.Content style={{ gap: 16 }}><View style={estilos.linha}><AvatarFuncionario funcionario={item} /><View style={{ flex: 1 }}><Text style={estilos.nome}>{item.nome}</Text><Text style={estilos.subtitulo}>{item.cargo || 'Funcionário'}{!item.ativo ? ' · Inativo' : ''}</Text></View></View><QuatroHorarios ponto={item.ponto_hoje} /></Card.Content>
      </Card>} />
    <FAB icon="plus" label="Funcionário" onPress={() => navigation.navigate('FuncionarioFormulario')} style={{ position: 'absolute', right: 20, bottom: 20, backgroundColor: '#E2E7FF' }} />
  </View>
}
