# render_episode.ps1 — 像素档案馆 长片 单集串行渲染+封装+校验+清理
# 用法：. .\render_episode.ps1 -Proj "<工程目录>" -Out "<成片mp4>"
# 前置：该工程已 npx hyperframes check 0 error，audio\narration.wav 已就绪。
param(
  [Parameter(Mandatory=$true)][string]$Proj,
  [Parameter(Mandatory=$true)][string]$Out,
  [int]$Crf = 22
)

$ErrorActionPreference = "Stop"
$lockDir = "D:\豆包产物\像素档案馆\03_源码工程\_RENDER_LOCK"

function Say($m){ Write-Output ("[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $m) }

# ---------- 1. 抢渲染槽（含死槽检测）----------
function Get-FreeSlot {
  foreach($s in @("slot1","slot2")){
    $p = Join-Path $lockDir $s
    if(-not (Test-Path $p)){ return $s }
    try {
      $owner = [int]((Get-Content $p -Encoding utf8 | Select-Object -First 1) -split ';')[0]
      if(-not (Get-Process -Id $owner -ErrorAction SilentlyContinue)){ Remove-Item $p -Force; return $s }
    } catch { Remove-Item $p -Force; return $s }
  }
  return $null
}

$slot = $null
while(-not $slot){
  $cand = Get-FreeSlot
  if($cand){
    $p = Join-Path $lockDir $cand
    try {
      New-Item -ItemType File -Path $p -Value ("$PID;$(Split-Path $Proj -Leaf);$(Get-Date -Format o)") -ErrorAction Stop | Out-Null
      $slot = $cand
    } catch { $slot = $null }
  }
  if(-not $slot){ Say "等待渲染槽..."; Start-Sleep 15 }
}
Say "ACQUIRED $slot"

try {
  Set-Location $Proj
  $raw = Join-Path $Proj "renders\_raw.mp4"
  $nar = Join-Path $Proj "audio\narration.wav"
  $bgm = Join-Path $Proj "audio\bgm_src.mp3"
  if(Test-Path $raw){ Remove-Item $raw -Force }

  # ---------- 2. 渲染（无音频）----------
  Say "RENDER start ..."
  & npx hyperframes render . -o "renders\_raw.mp4" --fps 30 --resolution landscape --no-browser-gpu 2>&1 |
    Tee-Object -FilePath (Join-Path $Proj "render.log") | Select-Object -Last 6
  if(-not (Test-Path $raw)){ throw "render failed: no _raw.mp4" }

  # ---------- 3. 取旁白时长 ----------
  $N = [double](& ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $nar)
  Say ("narration duration = {0} s" -f [math]::Round($N,3))

  # ---------- 4. 混音 + 淡出 ----------
  # BGM 以旁白时长为准裁剪，结尾 2 秒淡出；人声为主、BGM 压低
  Say "MIX start ..."
  & ffmpeg -y -i $raw -i $nar -i $bgm `
    -filter_complex "[2:a]atrim=0:$($N),afade=t=out:st=($($N)-2):d=2,volume=0.22[bgm];[1:a]volume=1.0[vo];[vo][bgm]amix=inputs=2:duration=first:dropout_transition=2[a]" `
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 128k -ar 48000 `
    -movflags +faststart $Out 2>&1 | Tee-Object -FilePath (Join-Path $Proj "mix.log") | Select-Object -Last 4
  if(-not (Test-Path $Out)){ throw "mix failed: no output" }

  # ---------- 5. 成片硬校验（对照制作规格逐条核对）----------
  Say "VERIFY start ..."
  $probe = & ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,codec_name,pix_fmt -of json $Out | ConvertFrom-Json
  $v = $probe.streams[0]
  if("$($v.width)x$($v.height)" -ne "1920x1080"){ throw "分辨率不符: $($v.width)x$($v.height)" }
  if($v.codec_name -ne "h264"){ throw "编码不符: $($v.codec_name)" }
  if($v.pix_fmt -ne "yuv420p"){ throw "pix_fmt 不符: $($v.pix_fmt)" }

  $dur = [double](& ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $Out)
  Say ("done: {0}  {1}s  crf={2}" -f (Split-Path $Out -Leaf), [math]::Round($dur,2), $Crf)

} finally {
  # ---------- 6. 无论成败都释放槽 ----------
  & (Join-Path $lockDir "release.ps1")
  Say "SLOT released"
}
