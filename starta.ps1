# Startar Hemskärm-servern dolt på 127.0.0.1:5204 (om den inte redan lyssnar).
# Tailscale-routen /hemskarm ligger kvar i tailscale serve --bg och överlever omstart.
$d = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Get-NetTCPConnection -LocalPort 5204 -State Listen -ErrorAction SilentlyContinue) { Write-Output 'Redan igang pa 5204'; exit 0 }
Start-Process -WindowStyle Hidden -FilePath node -ArgumentList 'server.mjs' -WorkingDirectory $d `
  -RedirectStandardOutput (Join-Path $d 'server.log') -RedirectStandardError (Join-Path $d 'server.err.log')
Write-Output 'Startad'
