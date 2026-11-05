import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { api } from '../services/api'

export function useApi(caminho) {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [revisao, setRevisao] = useState(0)
  const recarregar = useCallback(() => setRevisao((v) => v + 1), [])
  useFocusEffect(useCallback(() => { recarregar() }, [recarregar]))
  useEffect(() => {
    if (!caminho) { setCarregando(false); return undefined }
    let ativo = true
    const controle = new AbortController()
    setCarregando(true)
    api(caminho, { signal: controle.signal }).then((resultado) => {
      if (ativo) { setDados(resultado); setErro('') }
    }).catch((e) => { if (ativo) { setErro(e.message); setDados(null) } })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false; controle.abort() }
  }, [caminho, revisao])
  return { dados, carregando, erro, recarregar }
}
