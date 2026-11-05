import React from 'react'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { PaperProvider, Icon, ActivityIndicator } from 'react-native-paper'
import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { AuthProvider } from './src/context/AuthContext'
import { useAuth } from './src/hooks/useAuth'
import LoginScreen from './src/screens/LoginScreen'
import CompanyRegisterScreen from './src/screens/CompanyRegisterScreen'
import DashboardScreen from './src/screens/DashboardScreen'
import EmployeesScreen from './src/screens/EmployeesScreen'
import EmployeeDetailScreen from './src/screens/EmployeeDetailScreen'
import EmployeeFormScreen from './src/screens/EmployeeFormScreen'
import ProfileScreen from './src/screens/ProfileScreen'
import { tema } from './src/theme'

const Stack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()
const navegacaoTema = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: tema.colors.primary, background: tema.colors.background, card: '#FFF', text: '#152139', border: '#E3E8F1' } }

function Abas() {
  return <Tab.Navigator screenOptions={({ route }) => ({ headerShown: false, tabBarActiveTintColor: '#344AC7', tabBarInactiveTintColor: '#67758B', tabBarStyle: { borderTopColor: '#E3E8F1', paddingTop: 8 }, tabBarIcon: ({ color, size }) => <Icon source={{ Painel: 'view-dashboard-outline', Funcionarios: 'account-group-outline', Empresa: 'office-building-outline' }[route.name]} color={color} size={size} /> })}>
    <Tab.Screen name="Painel" component={DashboardScreen} options={{ title: 'Visão geral' }} />
    <Tab.Screen name="Funcionarios" component={EmployeesScreen} options={{ title: 'Funcionários' }} />
    <Tab.Screen name="Empresa" component={ProfileScreen} />
  </Tab.Navigator>
}

function Navegacao() {
  const { autenticado, iniciando } = useAuth()
  if (iniciando) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" /></View>
  return <NavigationContainer theme={navegacaoTema}><Stack.Navigator screenOptions={{ headerShadowVisible: false, headerTintColor: '#152139', contentStyle: { backgroundColor: '#F3F5FA' } }}>
    {autenticado ? <>
      <Stack.Screen name="Inicio" component={Abas} options={{ title: 'Ponto Empresa', headerBackVisible: false }} />
      <Stack.Screen name="FuncionarioDetalhe" component={EmployeeDetailScreen} options={{ title: 'Ponto mensal' }} />
      <Stack.Screen name="FuncionarioFormulario" component={EmployeeFormScreen} options={{ title: 'Funcionário' }} />
    </> : <>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CadastroEmpresa" component={CompanyRegisterScreen} options={{ title: 'Criar conta' }} />
    </>}
  </Stack.Navigator></NavigationContainer>
}

export default function App() {
  return <SafeAreaProvider><PaperProvider theme={tema}><AuthProvider><StatusBar style="dark" /><Navegacao /></AuthProvider></PaperProvider></SafeAreaProvider>
}
