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

  // Focus a window by process name
  ipcMain.handle('focus-window', (_event, processName: string) => {
    return new Promise<void>((resolve, reject) => {
      if (os.platform() !== 'win32') {
        return reject(new Error('focus-window only supported on Windows'))
      }
      // Escape single quotes for PowerShell string literal
      const sanitized = processName.replace(/'/g, "''")
      const script = `
        $proc = Get-Process -Name '${sanitized}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
        if ($proc) {
          Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@
          [WinAPI]::ShowWindow($proc.MainWindowHandle, 9)
          [WinAPI]::SetForegroundWindow($proc.MainWindowHandle)
        }
      `
      execFile('powershell', ['-NoProfile', '-Command', script], { timeout: 5000 }, (err) => {
        if (err) reject(new Error('focus-window failed'))
        else resolve()
      })
    })
  })
}
