param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"

if (-not (Test-Path -LiteralPath (Join-Path $dist "index.html"))) {
  throw "dist/index.html not found. Run npm run build:pwa first."
}

if (-not $OutputPath) {
  $revision = (git -C $root rev-parse --short HEAD).Trim()
  $OutputPath = Join-Path $root "8plus16bit-pwa-2.0-$revision-cloudflare-pages.zip"
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $resolvedOutput) {
  Remove-Item -LiteralPath $resolvedOutput -Force
}

Add-Type -AssemblyName System.IO.Compression
$stream = [System.IO.File]::Open(
  $resolvedOutput,
  [System.IO.FileMode]::CreateNew,
  [System.IO.FileAccess]::ReadWrite,
  [System.IO.FileShare]::None
)
$archive = [System.IO.Compression.ZipArchive]::new(
  $stream,
  [System.IO.Compression.ZipArchiveMode]::Create,
  $false
)

try {
  $distPath = (Resolve-Path -LiteralPath $dist).Path
  Get-ChildItem -LiteralPath $distPath -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($distPath.Length + 1).Replace("\", "/")
    $entry = $archive.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($_.FullName)
    try {
      $fileStream.CopyTo($entryStream)
    } finally {
      $fileStream.Dispose()
      $entryStream.Dispose()
    }
  }
} finally {
  $archive.Dispose()
  $stream.Dispose()
}

Write-Output $resolvedOutput
