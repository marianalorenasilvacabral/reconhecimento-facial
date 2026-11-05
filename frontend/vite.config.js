import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Dois modos:
//  - padrão (npm run dev): tela do computador, em http://localhost:5173
//  - celular (npm run dev:celular): serve a página da câmera do celular em https://<IP>:5174.
//    O navegador do celular só libera a câmera em páginas https; o certificado é local e
//    autoassinado (o celular mostrará um aviso, esperado).
//    Neste modo a API NÃO fica exposta: o único caminho liberado para o celular é o envio de
//    quadros (POST /api/celular/<token>/quadro). Qualquer outro pedido recebe 404.
const SO_ENVIO_DE_QUADROS = /^\/api\/celular\/[A-Za-z0-9_-]{8,128}\/quadro$/

export default defineConfig(({ mode }) => {
  // Cada servidor precisa de um cache próprio ao rodar PC, celular e testes juntos.
  const cacheDir = process.env.CACHE_DIR_VITE || `node_modules/.vite-${mode === 'celular' ? 'celular' : 'computador'}`
  if (mode !== 'celular') {
    return { cacheDir, plugins: [react()], server: { host: '127.0.0.1', port: 5173, strictPort: true } }
  }
  return {
    cacheDir,
    plugins: [react(), basicSsl()],
    server: {
      port: 5174,
      strictPort: true,
      host: true, // escuta na rede local, para o celular alcançar
      proxy: {
        '/api': {
          target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000',
          rewrite: (caminho) => caminho.replace(/^\/api/, ''),
          xfwd: true, // marca o pedido como vindo de fora: a API recusa as rotas "somente local"
          bypass: (req) => {
            const caminho = (req.url ?? '').split('?')[0]
            if (req.method === 'POST' && SO_ENVIO_DE_QUADROS.test(caminho)) return undefined
            return false // o Vite responde 404
          },
        },
      },
    },
  }
})
