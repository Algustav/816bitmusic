$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$emsdk = Join-Path $root ".tooling\emsdk"
$cmakeBin = Join-Path $root ".tooling\python-packages\bin"
$source = Join-Path $root "third_party\game-music-emu"
$build = Join-Path $root ".tooling\build-gme"
$output = Join-Path $root "public\vendor\gme-realtime"

if (-not (Test-Path (Join-Path $emsdk "emsdk_env.ps1"))) {
  throw "Emscripten SDK is missing. Install it under .tooling/emsdk first."
}

New-Item -ItemType Directory -Force $build, $output | Out-Null

. (Join-Path $emsdk "emsdk_env.ps1")
$env:PATH = "$cmakeBin;$env:PATH"
$env:PYTHONPATH = Join-Path $root ".tooling\python-packages"

& emcmake cmake -S $source -B $build -G Ninja `
  -DGME_BUILD_SHARED=OFF `
  -DGME_BUILD_STATIC=ON `
  -DGME_BUILD_TESTING=OFF `
  -DGME_BUILD_EXAMPLES=OFF `
  -DGME_ZLIB=OFF `
  -DUSE_GME_AY=OFF `
  -DUSE_GME_GBS=OFF `
  -DUSE_GME_GYM=OFF `
  -DUSE_GME_HES=OFF `
  -DUSE_GME_KSS=OFF `
  -DUSE_GME_NSF=ON `
  -DUSE_GME_NSFE=ON `
  -DUSE_GME_SAP=OFF `
  -DUSE_GME_SPC=OFF `
  -DUSE_GME_VGM=OFF
if ($LASTEXITCODE -ne 0) { throw "GME configure failed." }

& cmake --build $build
if ($LASTEXITCODE -ne 0) { throw "GME static library build failed." }

$library = Get-ChildItem -Path $build -Recurse -Filter "libgme.a" | Select-Object -First 1
if (-not $library) { throw "libgme.a was not produced." }

$bridge = Join-Path $root "third_party\realtime-gme\bridge.c"
$wasm = Join-Path $output "realtime-gme.wasm"
& emcc $bridge $library.FullName `
  "-I$source\gme" `
  -O3 `
  --no-entry `
  "-sSTANDALONE_WASM=1" `
  "-sALLOW_MEMORY_GROWTH=1" `
  "-sINITIAL_MEMORY=33554432" `
  "-sFILESYSTEM=0" `
  "-sEXPORTED_FUNCTIONS=['_malloc','_free','_chip_load','_chip_destroy','_chip_start_track','_chip_render','_chip_mute_voice','_chip_mute_mask','_chip_set_fade','_chip_voice_count','_chip_voice_name','_chip_track_count','_chip_track_ended','_chip_tell','_chip_track_length','_chip_track_fade','_chip_last_error']" `
  -o $wasm
if ($LASTEXITCODE -ne 0) { throw "Realtime GME WASM build failed." }

Get-Item $wasm | Select-Object FullName, Length, LastWriteTime
