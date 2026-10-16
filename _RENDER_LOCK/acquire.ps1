# acquire.ps1 — 获取一个渲染槽（全机最多 2）。用法：. .\acquire.ps1 "EP25"
# 成功返回槽名（slot1/slot2）到全局变量 $SLOT；含死槽检测（槽内 PID 已不存在则抢占）。
param([string]$Tag = "EP")

$lockDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-FreeSlot {
  foreach($s in @("slot1","slot2")){
    $p = Join-Path $lockDir $s
    if(-not (Test-Path $p)){ return $s }
    try {
      $line = (Get-Content $p -Encoding utf8 -ErrorAction Stop | Select-Object -First 1)
      $owner = [int]($line -split ';')[0]
      $alive = $false
      if(Get-Process -Id $owner -ErrorAction SilentlyContinue){ $alive = $true }
      # 死槽检测：持有者进程已不存在，抢占
      if(-not $alive){ Remove-Item $p -Force -ErrorAction SilentlyContinue; return $s }
    } catch { Remove-Item $p -Force -ErrorAction SilentlyContinue; return $s }
  }
  return $null
}

$global:SLOT = $null
while(-not $global:SLOT){
  $candidate = $null
  # 先找候选再尝试原子创建，降低两 shard 抢同一槽的概率
  $candidate = Get-FreeSlot
  if($candidate){
    $p = Join-Path $lockDir $candidate
    try {
      New-Item -ItemType File -Path $p -Value ("$PID;$Tag;$(Get-Date -Format o)") -ErrorAction Stop | Out-Null
      $global:SLOT = $candidate
    } catch { $global:SLOT = $null }
  }
  if(-not $global:SLOT){ Start-Sleep -Seconds 15 }
}
Write-Output ("ACQUIRED " + $global:SLOT + " for " + $Tag + " pid=" + $PID)
