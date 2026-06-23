# 🔍 Disk Space Analyzer & Growth Tracker

A premium, interactive web dashboard and automated scanning engine designed to analyze, visualize, and monitor disk space usage across multiple drives on Windows.

It includes a **scheduler** for automated background scans and a **growth comparison tool** to track how files accumulate over time.

---

## ✨ Features

- **📊 Premium Web Dashboard:** Sleek, modern dark-themed dashboard with Outfit typography and glassmorphic aesthetics.
- **📁 Interactive Folder Explorer:** Drills down into directories recursively with absolute/percentage size indicators.
- **📈 Growth Tracking:** Compares the active scan with the previous run, pointing out folders that grew or shrank the most.
- **🕒 Background Scheduling:** Integrates with Windows Task Scheduler to scan your drives automatically.
- **🛡️ Privacy-First:** Excludes scanning results (`*.json`) automatically via `.gitignore`, keeping your private system directory details off GitHub.

---

## 🛠️ Project Structure

- `scanner.py` - Core multi-threaded directory scanner (outputs JSON).
- `run_scheduled_scans.py` - Automates scanning of all defined drives, rotating previous results to `.bak` files.
- `compare_scans.py` - Compares current scans with previous `.bak` files to report folder and file growth.
- `setup_scheduler.ps1` - PowerShell script to register a weekly background scan task.
- `index.html` / `style.css` / `app.js` - Interactive frontend client.
- `.gitignore` - Safeguards personal scanning data.

---

## 🚀 Getting Started

### 1. Run a Scan Manually
You can run a scan on any directory:
```bash
python scanner.py -p "C:\Users" -o scan_results.json
```

To run a full scan across all drives and prepare backup versions:
```bash
python run_scheduled_scans.py
```

### 2. Open the Interactive Visualizer
Start a local web server in the project directory:
```bash
python -m http.server 8000
```
Then open your browser and navigate to: **[http://localhost:8000](http://localhost:8000)**. Use the dropdown in the header to switch between drives.

### 3. Track Growth
To compare your current drive usage against the previous scan and see what changed:
```bash
python compare_scans.py
```

### 4. Setup Automatic Weekly Scans (Windows)
Open PowerShell as **Administrator** and run the setup script:
```powershell
Set-ExecutionPolicy Bypass -Scope Process
.\setup_scheduler.ps1
```
This registers a silent task that runs every **Sunday at 03:00 AM**.

---

## 📦 Publishing to GitHub (Public Repo)

Follow these steps to upload this project to your GitHub account:

1. **Create a new public repository** on [GitHub](https://github.com/new). Name it `disk-space-analyzer` (do **not** initialize it with a README or gitignore, since they are already here!).
2. Open a terminal in this folder and run:
   ```bash
   # Add remote repository (replace with your GitHub username)
   git remote add origin https://github.com/YOUR_USERNAME/disk-space-analyzer.git
   
   # Rename branch to main
   git branch -M main
   
   # Push to GitHub
   git push -u origin main
   ```
3. *Note: Your private scan data (`*_results.json`) is listed in `.gitignore` and will remain safe on your local PC!*
