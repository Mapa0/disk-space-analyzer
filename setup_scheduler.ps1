# setup_scheduler.ps1
# Script PowerShell para agendar a varredura automática no Agendador de Tarefas do Windows

$TaskName = "DiskSpaceAnalyzer_WeeklyScan"
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) {
    $ScriptDir = Get-Location
}
$ScriptPath = Join-Path $ScriptDir "run_scheduled_scans.py"

# Encontrar o executável do Python
$PythonExe = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
if (-not $PythonExe) {
    $PythonExe = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
}

if (-not $PythonExe) {
    Write-Host "Erro: Python não foi encontrado no PATH do sistema. Instale o Python e tente novamente." -ForegroundColor Red
    exit
}

Write-Host "Configurando agendamento da tarefa..." -ForegroundColor Cyan
Write-Host "Caminho do Script: $ScriptPath" -ForegroundColor Gray
Write-Host "Executável Python: $PythonExe" -ForegroundColor Gray

# Definir a Ação (Executar python.exe com o script em segundo plano no diretório correto)
# Usando 'pythonw.exe' se disponível para evitar a abertura de janelas de terminal
$Action = New-ScheduledTaskAction -Execute $PythonExe -Argument "`"$ScriptPath`"" -WorkingDirectory $ScriptDir

# Definir o Gatilho (Toda semana, no Domingo às 03:00 da manhã)
$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 3:00am

# Definir as Configurações da Tarefa (permitir execução se estiver na bateria, acordar se necessário, etc.)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# Definir o Principal (Rodar com privilégios máximos para conseguir ler todos os diretórios do PC)
# Usamos o usuário logado com privilégios elevados (RunLevel Highest) para garantir acesso a partições montadas do usuário
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -RunLevel Highest

# Tentar registrar a tarefa
try {
    # Remover tarefa antiga se existir
    Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false
    
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description "Executa varredura semanal automática para o Disk Space Analyzer." -ErrorAction Stop
    
    Write-Host "`nSucesso! A tarefa '$TaskName' foi registrada com sucesso." -ForegroundColor Green
    Write-Host "Ela está agendada para rodar todos os domingos às 03:00 AM." -ForegroundColor Green
    Write-Host "Você também pode iniciar ela manualmente a qualquer momento rodando o comando:" -ForegroundColor Gray
    Write-Host "Start-ScheduledTask -TaskName `"$TaskName`"" -ForegroundColor Yellow
}
catch {
    Write-Host "`nErro ao registrar a tarefa: $_" -ForegroundColor Red
    Write-Host "Certifique-se de executar este script em um terminal PowerShell como Administrador." -ForegroundColor Yellow
}
