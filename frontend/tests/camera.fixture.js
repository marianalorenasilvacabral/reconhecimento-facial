import { test as base, expect } from '@playwright/test'

// Um fluxo real de vídeo gerado por canvas evita disputas pelo dispositivo falso
// global do Chrome entre contextos. Cada chamada cria uma câmera independente.
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas')
        canvas.width = 640
        canvas.height = 480
        const desenhar = () => {
          const desenho = canvas.getContext('2d')
          desenho.fillStyle = '#708090'
          desenho.fillRect(0, 0, canvas.width, canvas.height)
        }
        desenhar()
        const intervalo = setInterval(desenhar, 100)
        const fluxo = canvas.captureStream(10)
        for (const track of fluxo.getTracks()) {
          const parar = track.stop.bind(track)
          track.stop = () => { clearInterval(intervalo); parar() }
        }
        return fluxo
      }
      navigator.mediaDevices.enumerateDevices = async () => [{
        deviceId: 'camera-simulada', kind: 'videoinput', label: 'Câmera simulada dos testes', groupId: 'teste',
      }]
    })
    await use(context)
  },
})

export { expect }
