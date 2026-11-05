import React, { createContext, useCallback, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { api, configurarApi, enderecoApi } from '../services/api'

export const AuthContext = createContext(null)
const CHAVE = '@pontoempresa/sessao'

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(null)
  const [iniciando, setIniciando] = useState(true)
  const [url, setUrl] = useState(enderecoApi())
  const limpar = useCallback(async () => {
    configurarApi(null, null)
    setSessao(null)
    await AsyncStorage.removeItem(CHAVE)
  }, [])
  useEffect(() => {
    let ativo = true
    ;(async () => {
      try {
        const [salva, base] = await Promise.all([AsyncStorage.getItem(CHAVE), AsyncStorage.getItem('@pontoempresa/api')])
        const restaurada = salva ? JSON.parse(salva) : null
        configurarApi(base, restaurada?.token, limpar)
        if (!ativo) return
        if (base) setUrl(base)
        if (restaurada) setSessao(restaurada)
      } catch { await AsyncStorage.removeItem(CHAVE) }
      finally { if (ativo) setIniciando(false) }
    })()
    return () => { ativo = false }
  }, [limpar])

  async function autenticar(dados, cadastro = false) {
    const resultado = await api(cadastro ? '/auth/cadastro' : '/auth/login', { method: 'POST', body: dados })
    await AsyncStorage.setItem(CHAVE, JSON.stringify(resultado))
    configurarApi(null, resultado.token, limpar)
    setSessao(resultado)
  }
  async function sair() {
    try { await api('/auth/logout', { method: 'POST' }) } finally { await limpar() }
  }
  async function salvarEndereco(novo) {
    if (!/^https?:\/\/[^\s/]+(?::\d+)?\/?$/.test(novo.trim())) throw new Error('Informe um endereço como http://192.168.0.10:3001.')
    const endereco = novo.trim().replace(/\/$/, '')
    await AsyncStorage.setItem('@pontoempresa/api', endereco)
    configurarApi(endereco, sessao?.token, limpar)
    setUrl(endereco)
  }
  return <AuthContext.Provider value={{ empresa: sessao?.empresa, autenticado: Boolean(sessao), iniciando, autenticar, sair, url, salvarEndereco }}>{children}</AuthContext.Provider>
}
