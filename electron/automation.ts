import { ipcMain } from 'electron'
import { execFile } from 'child_process'
import os from 'os'

export function setupAutomation() {
  // Send keystrokes to active window (Windows only for now)
  ipcMain.handle('send-keys', (_event, keys: string) => {
    return new Promise<void>((resolve, reject) => {
      if (os.platform() !== 'win32') {
        return reject(new Error('SendKeys only supported on Windows'))
      }
      // Use execFile with -Command arg to avoid shell injection
      // Escape single quotes for PowerShell string literal
      const sanitized = keys.replace(/'/g, "''")
      const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sanitized}')`
      execFile('powershell', ['-NoProfile', '-Command', script], { timeout: 5000 }, (err) => {
        if (err) reject(new Error('SendKeys failed'))
        else resolve()
      })
    })
  })

  // Focus a window by name (matches window title OR process name)
  ipcMain.handle('focus-window', (_event, name: string) => {
    return new Promise<void>((resolve, reject) => {
      if (os.platform() !== 'win32') {
        return reject(new Error('focus-window only supported on Windows'))
      }
      const sanitized = name.replace(/'/g, "''")
      // First try matching by window title (EnumWindows), then fall back to process name.
      // This allows both "微信" (title) and "WeChat" (process) to work.
      const script = `
Add-Type -Name FocusUtil -Namespace Win -MemberDefinition '
[DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);
[DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);
[DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, System.Text.StringBuilder s, int n);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
public delegate bool EnumWindowsProc(IntPtr h, IntPtr lp);
' -ErrorAction SilentlyContinue
$target = '${sanitized}'.ToLower()
$found = [IntPtr]::Zero
[Win.FocusUtil]::EnumWindows({param($h,$p)
  if(-not [Win.FocusUtil]::IsWindowVisible($h)){return $true}
  $len=[Win.FocusUtil]::GetWindowTextLength($h)
  if($len -eq 0){return $true}
  $sb=New-Object System.Text.StringBuilder($len+1)
  [Win.FocusUtil]::GetWindowText($h,$sb,$sb.Capacity)|Out-Null
  if($sb.ToString().ToLower().Contains($target)){
    $script:found=$h; return $false
  }
  return $true
},[IntPtr]::Zero)|Out-Null
if($found -ne [IntPtr]::Zero){
  [Win.FocusUtil]::ShowWindow($found,9)|Out-Null
  [Win.FocusUtil]::SetForegroundWindow($found)|Out-Null
  Write-Output 'OK'
} else {
  $proc=Get-Process -ErrorAction SilentlyContinue|Where-Object{$_.ProcessName -match $target -and $_.MainWindowHandle -ne 0}|Select-Object -First 1
  if($proc){
    [Win.FocusUtil]::ShowWindow($proc.MainWindowHandle,9)|Out-Null
    [Win.FocusUtil]::SetForegroundWindow($proc.MainWindowHandle)|Out-Null
    Write-Output 'OK'
  } else {
    Write-Output 'NOTFOUND'
  }
}
`
      execFile('powershell', ['-NoProfile', '-Command', script], { timeout: 8000 }, (err, stdout) => {
        if (err) return reject(new Error('focus-window failed'))
        const result = (stdout || '').trim()
        if (result === 'NOTFOUND') return reject(new Error(`Window "${name}" not found`))
        resolve()
      })
    })
  })
}
