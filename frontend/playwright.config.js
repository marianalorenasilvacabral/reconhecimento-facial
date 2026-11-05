import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:15173',
    channel: 'chrome',
    headless: true,
    ignoreHTTPSErrors: true,
    permissions: ['camera'],
    launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: '..\\backend\\.venv\\Scripts\\python.exe ..\\tests\\servidor_navegador.py',
      url: 'http://127.0.0.1:18000/saude',
      timeout: 60000,
    },
    {
      command: 'npm run dev -- --port 15173',
      url: 'http://127.0.0.1:15173',
      env: { VITE_API_URL: 'http://127.0.0.1:18000', VITE_MODO_DEMO: 'false', CACHE_DIR_VITE: 'node_modules/.vite-teste-computador' },
    },
    {
      command: 'npm run dev:celular -- --port 15174',
      url: 'https://127.0.0.1:15174',
      ignoreHTTPSErrors: true,
      env: { VITE_API_URL: '/api', API_PROXY_TARGET: 'http://127.0.0.1:18000', CACHE_DIR_VITE: 'node_modules/.vite-teste-celular' },
    },
  ],
})
