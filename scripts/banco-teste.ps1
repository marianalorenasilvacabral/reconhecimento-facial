param([ValidateSet('iniciar', 'parar')][string]$Acao = 'iniciar')
$ErrorActionPreference = 'Stop'
$raizProjeto = Split-Path -Parent $PSScriptRoot
$pastaDados = Join-Path $raizProjeto '.tools\postgres-test'
$pastaLog = Join-Path $raizProjeto '.tools\postgres-test.log'
$instalacao = Get-ChildItem -LiteralPath 'C:\Program Files\PostgreSQL' -Directory |
    Where-Object { $_.Name -match '^\d+$' } |
    Sort-Object { [int]$_.Name } -Descending | Select-Object -First 1
if (!$instalacao) { throw 'PostgreSQL nao encontrado em C:\Program Files\PostgreSQL.' }
$binarios = Join-Path $instalacao.FullName 'bin'
$pgCtl = Join-Path $binarios 'pg_ctl.exe'

if ($Acao -eq 'parar') {
    & $pgCtl -D $pastaDados -w -m fast stop
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel parar o banco de testes.' }
    exit
}

New-Item -ItemType Directory -Path (Join-Path $raizProjeto '.tools') -Force | Out-Null
if (!(Test-Path -LiteralPath (Join-Path $pastaDados 'PG_VERSION'))) {
    & (Join-Path $binarios 'initdb.exe') -D $pastaDados -U reconhecimento_test -A trust --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar a instancia exclusiva de testes.' }
}
& $pgCtl -D $pastaDados status *> $null
if ($LASTEXITCODE -ne 0) {
    & $pgCtl -D $pastaDados -l $pastaLog -o '-h 127.0.0.1 -p 55432' -w start
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao iniciar. Verifique se a porta 55432 esta livre.' }
}
foreach ($nomeBanco in @('reconhecimento_teste', 'reconhecimento_navegador_teste')) {
    $existe = & (Join-Path $binarios 'psql.exe') -h 127.0.0.1 -p 55432 -U reconhecimento_test -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$nomeBanco'"
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao consultar a instancia de testes.' }
    if ($existe -ne '1') {
        & (Join-Path $binarios 'createdb.exe') -h 127.0.0.1 -p 55432 -U reconhecimento_test $nomeBanco
        if ($LASTEXITCODE -ne 0) { throw "Falha ao criar $nomeBanco." }
    }
}
$arquivoEnv = Join-Path $raizProjeto '.env.test'
if (!(Test-Path -LiteralPath $arquivoEnv)) {
    @(
        'TEST_DATABASE_URL=postgresql+psycopg://reconhecimento_test@127.0.0.1:55432/reconhecimento_teste'
        'BROWSER_TEST_DATABASE_URL=postgresql+psycopg://reconhecimento_test@127.0.0.1:55432/reconhecimento_navegador_teste'
    ) | Set-Content -LiteralPath $arquivoEnv -Encoding ASCII
}
Write-Output 'Banco de testes disponivel em 127.0.0.1:55432. O PostgreSQL principal nao foi alterado.'
