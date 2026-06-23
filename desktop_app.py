import os
import sys
import argparse
import threading
import time
import json
import ctypes
from datetime import datetime

# Add current folder to path to ensure we can import project modules
if hasattr(sys, '_MEIPASS'):
    current_dir = sys._MEIPASS
    data_dir = os.path.dirname(sys.executable)
else:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = current_dir

sys.path.insert(0, current_dir)

import server
import scanner
import compare_scans

# Scan file definitions (mirrors server.py / run_scheduled_scans.py)
SCAN_FILES = {
    "C_drive_results.json": "C:\\",
    "D_drive_results.json": "D:\\",
    "E_drive_results.json": "E:\\",
    "F_drive_results.json": "F:\\",
    "scan_results.json": os.path.expanduser("~")
}


def hide_console_window():
    """Hide the console window when running in GUI mode on Windows."""
    try:
        kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
        user32 = ctypes.WinDLL('user32', use_last_error=True)
        hwnd = kernel32.GetConsoleWindow()
        if hwnd:
            user32.ShowWindow(hwnd, 0)  # SW_HIDE = 0
    except Exception:
        pass


def format_bytes(size_bytes, decimals=2):
    """Format bytes to human-readable string."""
    if size_bytes == 0:
        return "0 Bytes"
    k = 1024
    sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"]
    i = 0
    val = float(size_bytes)
    while val >= k and i < len(sizes) - 1:
        val /= k
        i += 1
    return f"{val:.{decimals}f} {sizes[i]}"


def get_largest_folders(tree_node, limit=15):
    """Recursively find the largest folders from the scan tree."""
    folders = []

    def traverse(node):
        if not node:
            return
        if node.get("is_dir"):
            folders.append({"name": node["name"], "path": node["path"], "size": node["size"]})
            for child in node.get("children", []):
                traverse(child)

    traverse(tree_node)
    folders.sort(key=lambda x: x["size"], reverse=True)
    # Skip the root node (index 0)
    return folders[1:limit + 1]


# ─── CLI Command Handlers ─────────────────────────────────────────────

def cmd_gui():
    """Launch the GUI desktop application."""
    hide_console_window()

    import webview

    server_thread = threading.Thread(target=server.main, daemon=True)
    server_thread.start()

    time.sleep(0.5)

    icon_path = os.path.join(current_dir, "icon.ico")
    if not os.path.exists(icon_path):
        icon_path = None

    webview.create_window(
        title="Disk Space Analyzer",
        url=f"http://localhost:{server.PORT}",
        width=1350,
        height=850,
        min_size=(1024, 768),
        background_color="#0b0c10"
    )

    webview.start(icon=icon_path)


def cmd_scan(args):
    """Run a disk scan."""
    if args.all:
        print("--- Starting Full Disk Scan (All Configured Drives) ---\n")
        for filename, path in SCAN_FILES.items():
            if not os.path.exists(path):
                print(f"  Skipping {path} (does not exist)\n")
                continue

            output_path = os.path.join(data_dir, filename)
            bak_path = output_path + ".bak"

            # Rotate previous scan to .bak
            if os.path.exists(output_path):
                try:
                    import shutil
                    shutil.copy2(output_path, bak_path)
                except Exception:
                    pass

            print(f"  Scanning {path} ...")
            try:
                s = scanner.DiskScanner(path, max_depth=args.depth)
                results = s.scan()
                with open(output_path, "w", encoding="utf-8") as f:
                    json.dump(results, f, ensure_ascii=False, indent=2)
                print(f"  Saved → {output_path}\n")
            except Exception as e:
                print(f"  Error scanning {path}: {e}\n")

        print("--- All Scans Completed ---")
    else:
        target_path = args.path or os.path.expanduser("~")
        output_file = args.output or "scan_results.json"
        output_path = os.path.join(data_dir, output_file)
        bak_path = output_path + ".bak"

        # Rotate previous scan
        if os.path.exists(output_path):
            try:
                import shutil
                shutil.copy2(output_path, bak_path)
            except Exception:
                pass

        print(f"Scanning: {target_path}")
        print(f"Depth: {args.depth}")
        print(f"Output: {output_path}\n")

        s = scanner.DiskScanner(target_path, max_depth=args.depth)
        results = s.scan()

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        print(f"\nSaved scan results to: {output_path}")


def cmd_list(args):
    """List all available scan files with metadata."""
    print("📊 Available Scan Files\n")
    print(f"{'File':<30} {'Target':<20} {'Size':<12} {'Files':<10} {'Folders':<10} {'Scanned At'}")
    print("─" * 110)

    found_any = False
    for filename, label in SCAN_FILES.items():
        filepath = os.path.join(data_dir, filename)
        if os.path.exists(filepath):
            found_any = True
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                info = data.get("scan_info", {})
                total_size = format_bytes(info.get("total_size", 0))
                total_files = str(info.get("total_files", 0))
                total_folders = str(info.get("total_folders", 0))
                timestamp = info.get("timestamp", "N/A")
                try:
                    dt = datetime.fromisoformat(timestamp)
                    timestamp = dt.strftime("%Y-%m-%d %H:%M")
                except Exception:
                    pass
                target_path = info.get("target_path", label)
                print(f"{filename:<30} {target_path:<20} {total_size:<12} {total_files:<10} {total_folders:<10} {timestamp}")
            except Exception as e:
                print(f"{filename:<30} {'Error reading':<20} {str(e)}")

    if not found_any:
        print("\nNo scan files found. Run 'DiskSpaceAnalyzer.exe scan --all' to create scans.")

    print(f"\nScan directory: {data_dir}")


def cmd_export(args):
    """Export a formatted markdown analysis for AI agent consumption."""
    scan_file = args.scan or "C_drive_results.json"
    filepath = os.path.join(data_dir, scan_file)

    if not os.path.exists(filepath):
        print(f"Error: Scan file '{scan_file}' not found at {filepath}")
        print(f"Available files in {data_dir}:")
        for f in os.listdir(data_dir):
            if f.endswith("_results.json") or f == "scan_results.json":
                print(f"  - {f}")
        sys.exit(1)

    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    info = data.get("scan_info", {})
    top_files = data.get("top_large_files", [])[:20]
    extensions = data.get("extension_stats", [])[:15]
    cache_suggestions = data.get("cache_suggestions", [])
    top_folders = get_largest_folders(data.get("tree", {}), 15)

    exe_path = sys.executable if hasattr(sys, '_MEIPASS') else "DiskSpaceAnalyzer.exe"
    guide_path = os.path.join(data_dir, "AI_GUIDE.md")
    if not os.path.exists(guide_path):
        guide_path = os.path.join(current_dir, "AI_GUIDE.md")

    md = _build_agent_prompt(info, top_files, extensions, cache_suggestions, top_folders, exe_path, guide_path, scan_file, data)
    print(md)


def _build_agent_prompt(info, top_files, extensions, cache_suggestions, top_folders, exe_path, guide_path, scan_file, full_data):
    """Build the comprehensive agent prompt markdown string."""
    md = ""
    md += f"Baseado no repositório do github https://github.com/Mapa0/disk-space-analyzer, preciso realizar uma análise e limpeza de disco.\n\n"
    md += f"## 🛠️ Ferramentas Disponíveis\n\n"
    md += f"Você tem acesso ao executável **Disk Space Analyzer** com modo CLI. Caminho: `{exe_path}`\n\n"
    md += f"### Comandos CLI disponíveis:\n"
    md += f"```bash\n"
    md += f"# Listar scans disponíveis\n"
    md += f"\"{exe_path}\" list\n\n"
    md += f"# Escanear todos os drives\n"
    md += f"\"{exe_path}\" scan --all\n\n"
    md += f"# Escanear um diretório específico\n"
    md += f"\"{exe_path}\" scan --path \"C:\\\\Users\" --output custom_scan.json\n\n"
    md += f"# Exportar análise formatada\n"
    md += f"\"{exe_path}\" export --scan {scan_file}\n\n"
    md += f"# Comparar scan atual com backup anterior\n"
    md += f"\"{exe_path}\" compare --scan {scan_file}\n\n"
    md += f"# Ver caches detectados\n"
    md += f"\"{exe_path}\" caches\n"
    md += f"```\n\n"
    md += f"📖 **Documentação completa de uso para IA:** Consulte o arquivo `{guide_path}` para estratégias de limpeza, comandos PowerShell avançados, e workflow recomendado.\n\n"
    md += f"---\n\n"

    md += f"## 📊 Dados da Análise Atual\n\n"
    md += f"### Informações Gerais:\n"
    md += f"- **Scan Utilizado:** `{scan_file}`\n"
    md += f"- **Diretório Raiz Escaneado:** `{info.get('target_path', 'N/A')}`\n"
    md += f"- **Tamanho Total:** {format_bytes(info.get('total_size', 0))}\n"
    md += f"- **Total de Arquivos:** {info.get('total_files', 0):,}\n"
    md += f"- **Total de Pastas:** {info.get('total_folders', 0):,}\n"

    timestamp = info.get('timestamp', '')
    md += f"- **Data da Varredura:** {timestamp}\n"
    try:
        scan_dt = datetime.fromisoformat(timestamp)
        age_hours = (datetime.now() - scan_dt).total_seconds() / 3600
        if age_hours > 24:
            md += f"- ⚠️ **ATENÇÃO:** Esta análise tem {age_hours:.0f} horas. Considere rodar um novo scan com `\"{exe_path}\" scan --all`\n"
    except Exception:
        pass
    md += "\n"

    # Cache suggestions
    md += f"### 🧹 Caches e Arquivos Temporários Detectados:\n"
    if cache_suggestions:
        total_cache = sum(c.get("size", 0) for c in cache_suggestions)
        md += f"**Total estimado de caches limpos:** {format_bytes(total_cache)}\n\n"
        for cache in cache_suggestions:
            paths_text = ", ".join(f"`{p}`" for p in cache.get("paths", []))
            md += f"- **{cache['name']}**: {format_bytes(cache.get('size', 0))}  \n  *Caminhos:* {paths_text}  \n  *Descrição:* {cache.get('description', '')}\n"
    else:
        md += "*Nenhum cache mapeado foi encontrado ou todos já foram limpos.*\n"
    md += "\n"

    # Top folders
    md += f"### 📂 Maiores Pastas Encontradas (Top 15):\n"
    for idx, f in enumerate(top_folders):
        md += f"{idx + 1}. `{f['path']}` ({format_bytes(f['size'])})\n"
    md += "\n"

    # Top files
    md += f"### 📄 Maiores Arquivos Encontrados (Top 20):\n"
    for idx, f in enumerate(top_files):
        md += f"{idx + 1}. `{f['path']}` ({format_bytes(f['size'])})\n"
    md += "\n"

    # Extensions
    md += f"### 📊 Principais Extensões de Arquivos (Top 15):\n"
    for ext in extensions:
        md += f"- `{ext['ext']}`: {format_bytes(ext['size'])}\n"
    md += "\n"

    # Instructions
    md += "---\n\n"
    md += "## 🤖 Instruções para o Agente de IA:\n\n"
    md += "1. **Verifique a atualidade dos dados:** Se a data da varredura for antiga (>24h), rode um novo scan: `\"" + str(exe_path) + "\" scan --all`\n"
    md += "2. **Consulte a documentação:** Leia o arquivo `" + str(guide_path) + "` para acessar estratégias de limpeza detalhadas, comandos PowerShell, e melhores práticas.\n"
    md += "3. **Análise de Risco:** Identifique quais itens podem ser limpos com segurança (caches, temps) vs. itens que precisam de confirmação do usuário.\n"
    md += "4. **Plano de Ação:** Crie um plano claro e categorizado de limpeza, estimando o espaço total que será liberado.\n"
    md += "5. **Execução Segura:** Use PowerShell para executar a limpeza. Sempre mostre o que será removido antes de executar.\n"
    md += "6. **Pós-Limpeza OBRIGATÓRIO:** Após qualquer limpeza, SEMPRE rode:\n"
    md += f"   ```bash\n   \"{exe_path}\" scan --all\n   ```\n"
    md += "   Isso atualiza os dados da aplicação GUI para que o usuário veja os resultados.\n"
    md += "7. **Compare resultados:** Rode `\"" + str(exe_path) + "\" compare --scan " + scan_file + "` para mostrar exatamente quanto espaço foi liberado.\n"

    return md


def cmd_compare(args):
    """Compare current scan with previous backup."""
    scan_file = args.scan or "C_drive_results.json"
    curr_path = os.path.join(data_dir, scan_file)
    bak_path = curr_path + ".bak"

    if not os.path.exists(curr_path):
        print(f"Error: Scan file '{scan_file}' not found at {curr_path}")
        sys.exit(1)

    print(f"# Disk Space Comparison: {scan_file}\n")
    report = compare_scans.compare_scan_files(curr_path, bak_path)
    print(report)


def cmd_caches(args):
    """Detect and report cleanable caches."""
    print("🧹 Cache & Temporary Files Analysis\n")

    s = scanner.DiskScanner(os.path.expanduser("~"))
    caches = s.scan_common_caches()

    if not caches:
        print("No known caches detected or all are already clean.")
        return

    total = sum(c["size"] for c in caches)
    print(f"Total cleanable cache size: {format_bytes(total)}\n")
    print(f"{'Cache Name':<30} {'Size':<15} {'Paths'}")
    print("─" * 90)

    for cache in caches:
        paths_str = "; ".join(cache["paths"])
        print(f"{cache['name']:<30} {format_bytes(cache['size']):<15} {paths_str}")

    print(f"\n{'─' * 90}")
    print(f"{'TOTAL':<30} {format_bytes(total)}")
    print(f"\nNote: Use PowerShell to delete these caches after reviewing. See AI_GUIDE.md for details.")


# ─── Main Entry Point ─────────────────────────────────────────────────

def main():
    # Configure UTF-8 output for Windows console
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    parser = argparse.ArgumentParser(
        prog="DiskSpaceAnalyzer",
        description="Disk Space Analyzer — Interactive GUI & CLI for disk analysis and cleanup assistance.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  DiskSpaceAnalyzer.exe                          Open the interactive GUI dashboard
  DiskSpaceAnalyzer.exe scan --all               Scan all configured drives
  DiskSpaceAnalyzer.exe scan --path "C:\\"        Scan a specific directory
  DiskSpaceAnalyzer.exe list                     List available scan files
  DiskSpaceAnalyzer.exe export --scan C_drive_results.json   Export analysis for AI
  DiskSpaceAnalyzer.exe compare --scan C_drive_results.json  Compare with previous scan
  DiskSpaceAnalyzer.exe caches                   Show detected caches
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # scan subcommand
    scan_parser = subparsers.add_parser("scan", help="Run a disk scan")
    scan_parser.add_argument("--all", action="store_true", help="Scan all configured drives")
    scan_parser.add_argument("--path", "-p", type=str, help="Directory path to scan")
    scan_parser.add_argument("--output", "-o", type=str, help="Output JSON filename (default: scan_results.json)")
    scan_parser.add_argument("--depth", "-d", type=int, default=6, help="Maximum tree depth (default: 6)")

    # list subcommand
    subparsers.add_parser("list", help="List all available scan files with metadata")

    # export subcommand
    export_parser = subparsers.add_parser("export", help="Export formatted analysis for AI agent")
    export_parser.add_argument("--scan", "-s", type=str, help="Scan filename to export (default: C_drive_results.json)")

    # compare subcommand
    compare_parser = subparsers.add_parser("compare", help="Compare current scan with previous backup")
    compare_parser.add_argument("--scan", "-s", type=str, help="Scan filename to compare (default: C_drive_results.json)")

    # caches subcommand
    subparsers.add_parser("caches", help="Detect and report cleanable application caches")

    args = parser.parse_args()

    if args.command is None:
        # No subcommand → launch GUI
        cmd_gui()
    elif args.command == "scan":
        cmd_scan(args)
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "compare":
        cmd_compare(args)
    elif args.command == "caches":
        cmd_caches(args)


if __name__ == "__main__":
    main()
