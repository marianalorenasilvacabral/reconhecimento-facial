import { test, expect } from './camera.fixture.js'

test.describe.configure({ mode: 'serial' })

const aluno = { id: 1, nome: 'Aluno Simulado', matricula: '2026001', data_nascimento: '2008-03-15', cpf: '***.***.***-25', turma: null }
const identificado = { status: 'identificado', rostos: 1, aluno }

test('cartão confirma, esconde dúvidas, troca de pessoa e falha de conexão', async ({ page }) => {
  let resultado = identificado
  let erro = false
  let pendente = false
  await page.route('**/identificacoes', async (route) => {
    if (pendente) return // o cartão precisa expirar mesmo sem resposta da API
    if (erro) return route.abort()
    await route.fulfill({ json: resultado })
  })
  await page.goto('/#identificacao')
  await page.getByRole('button', { name: 'Câmera do computador', exact: true }).click()
  const cartao = page.locator('aside.cartao')
  await expect(cartao).toContainText(aluno.nome)
  await expect(cartao).toContainText('***.***.***-25')
  for (const inseguro of [
    { status: 'revisao_necessaria', rostos: 2, aluno: null, motivo: 'Há mais de um rosto' },
    { status: 'nao_identificado', rostos: 1, aluno: null },
    { status: 'sem_rosto', rostos: 0, aluno: null },
  ]) {
    resultado = inseguro
    await expect(cartao).not.toContainText(aluno.nome)
    resultado = identificado
    await expect(cartao).toContainText(aluno.nome)
  }
  erro = true
  await expect(cartao).not.toContainText(aluno.nome)
  erro = false
  await expect(cartao).toContainText(aluno.nome)
  pendente = true
  await expect(cartao).not.toContainText(aluno.nome, { timeout: 6000 })
  await page.getByRole('button', { name: 'Desligar câmera' }).click()
  await expect(cartao).toContainText('Aguardando identificação')
})

test('cadastro, consulta e webcam atravessam React, FastAPI e PostgreSQL', async ({ page }) => {
  await page.goto('/#cadastro')
  await page.getByLabel('Nome completo', { exact: true }).fill('Participante Navegador')
  await page.getByLabel('Data de nascimento', { exact: true }).fill('2008-03-15')
  await page.getByLabel('CPF', { exact: true }).fill('52998224725')
  // Um PNG válido; o modelo é falso neste teste, a API e o banco são reais.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6H0AAAAASUVORK5CYII=', 'base64')
  await page.locator('input[type=file]').setInputFiles(Array.from({ length: 5 }, (_, i) => ({ name: `foto${i}.png`, mimeType: 'image/png', buffer: png })))
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Revisar cadastro' }).click()
  await page.getByRole('button', { name: 'Salvar cadastro' }).click()
  await expect(page.getByRole('heading', { name: 'Cadastro enviado' })).toBeVisible()
  await page.getByRole('link', { name: 'Consulta', exact: true }).click()
  await expect(page.getByText('Participante Navegador', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Identificação', exact: true }).click()
  await page.getByRole('button', { name: 'Câmera do computador', exact: true }).click()
  await expect(page.locator('aside.cartao')).toContainText('Participante Navegador')
  await page.getByRole('button', { name: 'Desligar câmera' }).click()
  await expect(page.locator('aside.cartao')).not.toContainText('Participante Navegador')
})

test('celular envia vídeo por HTTPS, mostra cartão no PC e perde conexão ao parar', async ({ page, context }) => {
  await page.goto('/#identificacao')
  await page.getByRole('button', { name: 'Usar o celular como câmera' }).click()
  await page.getByLabel('Endereço (IP) deste computador').fill('127.0.0.1')
  const link = page.locator('.link-celular')
  await expect(link).toContainText('#celular/')
  const endereco = (await link.textContent()).replace(':5174', ':15174')
  const celular = await context.newPage()
  await celular.goto(endereco)
  await celular.getByRole('button', { name: 'Iniciar', exact: true }).click()
  // Uma aba em segundo plano não exibe dados; o PC precisa estar visível.
  await page.bringToFront()
  await expect(page.getByText('● Celular conectado', { exact: true })).toBeVisible()
  await expect(page.locator('aside.cartao')).toContainText('Participante Navegador', { timeout: 15000 })
  await expect(celular.locator('body')).not.toContainText('Participante Navegador')
  await expect(celular.locator('body')).not.toContainText('***.***.***-25')
  const resposta = await celular.request.get('https://127.0.0.1:15174/api/alunos')
  expect(resposta.status()).toBe(404)
  await celular.getByRole('button', { name: 'Parar', exact: true }).click()
  await expect(page.locator('aside.cartao')).not.toContainText('Participante Navegador', { timeout: 7000 })
  await celular.getByRole('button', { name: 'Iniciar', exact: true }).click()
  await expect(page.locator('aside.cartao')).toContainText('Participante Navegador', { timeout: 10000 })
  await page.getByRole('button', { name: 'Gerar novo QR code' }).click()
  await expect(page.locator('aside.cartao')).not.toContainText('Participante Navegador')
  await expect(celular.getByRole('button', { name: 'Iniciar', exact: true })).toBeDisabled({ timeout: 7000 })
  await expect.poll(() => celular.locator('video').evaluate((v) => v.srcObject?.getTracks().some((t) => t.readyState === 'live') ?? false)).toBe(false)
})
