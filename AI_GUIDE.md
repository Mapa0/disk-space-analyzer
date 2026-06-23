# 🤖 Disk Space Analyzer — AI Agent Guide

This document is designed for AI coding assistants (e.g., Gemini, Claude, GPT) to understand how to use the Disk Space Analyzer tool programmatically via CLI commands, interpret scan results, and assist users with disk cleanup.

---

## 📍 Quick Reference

| Command | Description |
|---|---|
| `DiskSpaceAnalyzer.exe` | Opens the interactive GUI dashboard |
| `DiskSpaceAnalyzer.exe scan --all` | Scans all configured drives (C:\, D:\, E:\, F:\, ~) |
| `DiskSpaceAnalyzer.exe scan --path "C:\" --output results.json` | Scans a specific directory |
| `DiskSpaceAnalyzer.exe list` | Lists all available scan files with metadata |
| `DiskSpaceAnalyzer.exe export --scan C_drive_results.json` | Outputs a formatted markdown analysis to stdout |
| `DiskSpaceAnalyzer.exe compare --scan C_drive_results.json` | Compares current scan vs. previous backup |
| `DiskSpaceAnalyzer.exe caches` | Detects and reports cleanable caches |

---

## 🗂️ Scan JSON Structure

Each scan produces a JSON file with this schema:

```json
{
  "scan_info": {
    "target_path": "C:\\",           // Root path that was scanned
    "timestamp": "2025-01-15T...",   // ISO timestamp of when scan ran
    "total_size": 256000000000,      // Total bytes scanned
    "total_files": 450000,           // Number of files found
    "total_folders": 35000,          // Number of folders found
    "duration_seconds": 45.2         // How long the scan took
  },
  "tree": {
    "name": "C:\\",
    "path": "C:\\",
    "size": 256000000000,            // Total size in bytes
    "is_dir": true,
    "children": [                    // Recursive folder/file nodes
      {
        "name": "Users",
        "path": "C:\\Users",
        "size": 120000000000,
        "is_dir": true,
        "children": [...]
      },
      {
        "name": "pagefile.sys",
        "path": "C:\\pagefile.sys",
        "size": 8589934592,
        "is_dir": false
      }
    ]
  },
  "top_large_files": [               // Top 100 largest files found
    {
      "name": "bigfile.zip",
      "path": "C:\\Users\\user\\bigfile.zip",
      "size": 5000000000
    }
  ],
  "extension_stats": [               // File type breakdown by total size
    { "ext": ".exe", "size": 50000000000 },
    { "ext": ".dll", "size": 30000000000 }
  ],
  "cache_suggestions": [             // Detected cleanable caches
    {
      "name": "npm Cache",
      "paths": ["C:\\Users\\user\\AppData\\Roaming\\npm-cache"],
      "size": 2000000000,
      "description": "Cached npm package installations. Safe to clean up."
    }
  ]
}
```

### Important Notes on `tree`
- The tree has a `max_depth` of 6 by default. Beyond that depth, folder sizes are still calculated but children are not listed.
- Files and folders are sorted by size (descending) within each level.
- System folders like `$RECYCLE.BIN`, `System Volume Information` are excluded.

---

## 📂 Scan File Locations

When running as `.exe`, scan result files are saved **next to the executable**:

```
DiskSpaceAnalyzer.exe
C_drive_results.json          ← Current scan of C:\
C_drive_results.json.bak      ← Previous scan (for comparison)
D_drive_results.json
D_drive_results.json.bak
E_drive_results.json
F_drive_results.json
scan_results.json             ← User home directory scan (~)
scan_results.json.bak
```

---

## 🧹 Safe Cleanup Strategies

### ✅ Always Safe to Clean (No Risk)

| Category | Typical Paths | Notes |
|---|---|---|
| **User Temp Files** | `%LOCALAPPDATA%\Temp` | Windows temp files; apps recreate as needed |
| **npm Cache** | `%APPDATA%\npm-cache` | Package download cache; `npm cache clean --force` also works |
| **pip Cache** | `%LOCALAPPDATA%\pip\cache` | Python package cache; `pip cache purge` also works |
| **NuGet Cache** | `%USERPROFILE%\.nuget\packages` | .NET package cache; `dotnet nuget locals all --clear` also works |
| **Cargo Cache** | `%USERPROFILE%\.cargo\registry`, `.cargo\git` | Rust crate cache |
| **Gradle/Maven Cache** | `%USERPROFILE%\.gradle\caches`, `.m2\repository` | Java build caches |
| **VS Code Cache** | `%APPDATA%\Code\Cache`, `CachedData`, `CachedExtensionVSIXs` | Editor caches |
| **Discord Cache** | `%APPDATA%\discord\Cache`, `Code Cache`, `GPUCache` | Media cache |
| **Spotify Cache** | `%LOCALAPPDATA%\Spotify\Storage` | Offline music cache |
| **Windows Update Cleanup** | `C:\Windows\SoftwareDistribution\Download` | Old update files (needs admin) |
| **Thumbnails Cache** | `%LOCALAPPDATA%\Microsoft\Windows\Explorer\thumbcache_*` | File Explorer thumbnails |

### ⚠️ Clean with Caution (Ask User First)

| Category | Typical Paths | Risk |
|---|---|---|
| **Browser Caches** | Chrome/Edge/Firefox profile folders | Clears saved images/pages, may log user out |
| **Docker Images** | `docker system prune` | Removes unused images/containers |
| **WSL Distributions** | `%LOCALAPPDATA%\Packages\*Linux*` | May contain important Linux filesystems |
| **node_modules** | Various project directories | Need `npm install` to restore; safe if project is in git |
| **VS Code workspaceStorage** | `%APPDATA%\Code\User\workspaceStorage` | Workspace-specific settings/data |
| **LM Studio Cache** | `%USERPROFILE%\.cache\lm-studio` | May contain downloaded AI models user wants to keep |

### 🚫 Never Clean Without Explicit Permission

| Category | Why |
|---|---|
| **User Documents, Photos, Videos** | Personal files — only the user decides |
| **Game saves** | May not be cloud-synced |
| **Database files (.db, .sqlite)** | Application data |
| **Virtual machine disks (.vhd, .vmdk)** | Full VM environments |
| **Encryption keys, certificates** | Security-critical |

---

## 🔧 Useful PowerShell Commands for Deep Analysis

The AI agent can run these commands for deeper investigation when the user wants to dig into specific areas:

### Check Actual Drive Free Space
```powershell
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='Used(GB)';E={[math]::Round($_.Used/1GB,2)}}, @{N='Free(GB)';E={[math]::Round($_.Free/1GB,2)}}, @{N='Total(GB)';E={[math]::Round(($_.Used+$_.Free)/1GB,2)}}
```

### Find Large Files in a Specific Folder
```powershell
Get-ChildItem -Path "C:\Users" -Recurse -File -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 20 FullName, @{N='Size(MB)';E={[math]::Round($_.Length/1MB,2)}}
```

### Find Folders Consuming Most Space
```powershell
Get-ChildItem -Path "C:\Users\username" -Directory -ErrorAction SilentlyContinue | ForEach-Object { $size = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum; [PSCustomObject]@{Folder=$_.Name; SizeMB=[math]::Round($size/1MB,2)} } | Sort-Object SizeMB -Descending | Select-Object -First 15
```

### Find Duplicate Large Files (by size)
```powershell
Get-ChildItem -Path "C:\Users" -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 100MB } | Group-Object Length | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Group | Select-Object FullName, @{N='Size(MB)';E={[math]::Round($_.Length/1MB,2)}} }
```

### Check Recycle Bin Size
```powershell
(New-Object -ComObject Shell.Application).NameSpace(0xa).Items() | Measure-Object -Property Size -Sum | Select-Object @{N='RecycleBin(MB)';E={[math]::Round($_.Sum/1MB,2)}}
```

### Clean Temp Files
```powershell
# Preview what would be removed
Get-ChildItem -Path "$env:LOCALAPPDATA\Temp" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum | Select-Object @{N='TempSize(MB)';E={[math]::Round($_.Sum/1MB,2)}}

# Actually remove (run with confirmation)
Remove-Item -Path "$env:LOCALAPPDATA\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
```

### Check Windows Update Cache
```powershell
Get-ChildItem "C:\Windows\SoftwareDistribution\Download" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum | Select-Object @{N='UpdateCache(MB)';E={[math]::Round($_.Sum/1MB,2)}}
```

### Find Old/Unused Files (not accessed in 1 year)
```powershell
Get-ChildItem -Path "C:\Users\username\Downloads" -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.LastAccessTime -lt (Get-Date).AddYears(-1) } | Sort-Object Length -Descending | Select-Object -First 20 FullName, @{N='Size(MB)';E={[math]::Round($_.Length/1MB,2)}}, LastAccessTime
```

---

## 🔄 Recommended AI Workflow

Follow this workflow when helping a user with disk cleanup:

### 1. **Gather Data**
```
DiskSpaceAnalyzer.exe list
```
Check if scans exist and how recent they are. If older than 24 hours or missing, run a new scan:
```
DiskSpaceAnalyzer.exe scan --all
```

### 2. **Analyze**
```
DiskSpaceAnalyzer.exe export --scan C_drive_results.json
```
Review the formatted analysis. Identify:
- Top space consumers (folders and files)
- Cleanable caches
- Suspicious large files

### 3. **Deep Dive** (if needed)
Use PowerShell commands (see above) to investigate specific folders or find duplicates.

### 4. **Propose Cleanup Plan**
Present a clear, categorized plan to the user:
- **Safe to clean immediately** (caches, temp files)
- **Requires confirmation** (old downloads, unused projects)
- **Do not touch** (personal files, system files)

Include estimated space savings for each category.

### 5. **Execute Cleanup**
After user approval, run cleanup commands. Always:
- Start with the safest items first
- Show what will be deleted before deleting
- Use `-WhatIf` flag first when possible

### 6. **Verify & Re-scan**
After cleanup, always run a fresh scan to verify results:
```
DiskSpaceAnalyzer.exe scan --all
```
Then compare with the previous scan:
```
DiskSpaceAnalyzer.exe compare --scan C_drive_results.json
```

This ensures the UI dashboard shows the updated state and the user can visually verify the cleanup results.

---

## 📊 Reading the Scan Data Programmatically

You can also read the raw JSON files directly for more detailed analysis. The scan JSON files are located next to the executable. Load any `*_results.json` file and parse it according to the schema documented above.

Example: to find all folders larger than 1 GB in the tree:
```python
import json

with open("C_drive_results.json", "r") as f:
    data = json.load(f)

def find_large_folders(node, threshold=1_073_741_824):
    results = []
    if node.get("is_dir") and node.get("size", 0) > threshold:
        results.append((node["path"], node["size"]))
    for child in node.get("children", []):
        results.extend(find_large_folders(child, threshold))
    return results

large = find_large_folders(data["tree"])
for path, size in sorted(large, key=lambda x: x[1], reverse=True):
    print(f"{path}: {size / 1e9:.2f} GB")
```

---

## ⚡ Tips for the AI Agent

1. **Always check scan freshness.** If `scan_info.timestamp` is more than a day old, suggest running a new scan.
2. **Cache cleanup is the quickest win.** Start recommendations with cache cleanup — it's safe and often frees several GB.
3. **Be specific with paths.** Always show the user the exact paths you're proposing to clean.
4. **Estimate savings.** Calculate and present the total expected space savings before asking for confirmation.
5. **Re-scan after cleanup.** Always run `DiskSpaceAnalyzer.exe scan --all` after any cleanup to update the dashboard and verify results.
6. **Respect the user's data.** Never delete personal files, project code, or application data without explicit permission.
7. **Use compare for validation.** After cleanup, use `compare` to show the user exactly how much space was freed.
