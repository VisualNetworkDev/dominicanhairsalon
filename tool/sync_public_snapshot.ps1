[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendRoot = Split-Path -Parent $scriptRoot
$outputPath = Join-Path $frontendRoot 'data\site-data.json'
$apiUrl = 'https://script.google.com/macros/s/AKfycbzunUZqlntWZWulmE3ORRnrJszzaIWv4nfZX0-ZnXdZx2V7N_gCpSUwn7lXIZXH5t0K/exec'
$argsJson = [Uri]::EscapeDataString('[]')
$requestId = [Uri]::EscapeDataString("snapshot-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())")
$uri = "${apiUrl}?fn=getAppData&args=$argsJson&requestId=$requestId"

$response = Invoke-RestMethod -UseBasicParsing -Uri $uri -TimeoutSec 180
if (-not $response.ok -or -not $response.data) {
  throw 'El backend no entregó un catálogo válido para la copia rápida.'
}

$json = $response.data | ConvertTo-Json -Depth 100
[IO.File]::WriteAllText($outputPath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

[pscustomobject]@{
  Output = $outputPath
  CatalogVersion = $response.data.catalogVersion
  Services = @($response.data.services).Count
  GeneratedAt = [DateTimeOffset]::UtcNow.ToString('o')
}
