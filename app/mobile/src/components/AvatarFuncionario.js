import React from 'react'
import { Avatar } from 'react-native-paper'
import { iniciais } from '../utils/formatacao'

export default function AvatarFuncionario({ funcionario, size = 48 }) {
  return funcionario.foto_resumo ? <Avatar.Image size={size} source={{ uri: funcionario.foto_resumo }} /> : <Avatar.Text size={size} label={iniciais(funcionario.nome)} />
}
