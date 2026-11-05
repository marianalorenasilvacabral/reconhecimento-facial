import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/** Desenha o QR code de um texto (gerado no próprio navegador; nada é enviado a terceiros). */
export default function QrCode({ texto, tamanho = 220 }) {
  const [imagem, setImagem] = useState(null)

  useEffect(() => {
    let ativo = true
    QRCode.toDataURL(texto, { width: tamanho, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => ativo && setImagem(url))
      .catch(() => ativo && setImagem(null))
    return () => {
      ativo = false
    }
  }, [texto, tamanho])

  if (!imagem) return <div className="qr-vazio" style={{ width: tamanho, height: tamanho }} />
  return <img className="qr" src={imagem} width={tamanho} height={tamanho} alt="QR code para abrir a câmera no celular" />
}
