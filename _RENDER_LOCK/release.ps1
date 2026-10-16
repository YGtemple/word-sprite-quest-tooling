# release.ps1 — 释放当前 PID 持有的渲染槽。用法：. .\release.ps1
$lockDir = Split-Path -Parent $MyInvocation.MyCommand.Path

foreach($s in @("slot1","slot2")){
  $p = Join-Path $lockDir $s
  if(Test-Path $p){
    try {
      $line = (Get-Content $p -Encoding utf8 | Select-Object -First 1)
      $owner = [int]($line -split ';')[0]
      if($owner -eq $PID){ Remove-Item $p -Force; Write-Output ("RELEASED " + $s) }
    } catch {}
  }
}
