import os
import json
import sys

# Ensure UTF-8 output on Windows console to support emojis and accented characters
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def format_size(size_bytes):
    if size_bytes == 0:
        return "0 B"
    # Support negative sizes for shrinkage
    negative = size_bytes < 0
    size_bytes = abs(size_bytes)
    
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(units) - 1:
        size_bytes /= 1024
        i += 1
        
    prefix = "-" if negative else "+" if size_bytes > 0 else ""
    # For absolute sizes we might not want +/- prefix, but for comparisons we do.
    return f"{prefix}{size_bytes:.2f} {units[i]}"

def format_abs_size(size_bytes):
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(units) - 1:
        size_bytes /= 1024
        i += 1
    return f"{size_bytes:.2f} {units[i]}"

def load_json(filepath):
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None

def flatten_tree(node, flat_dict):
    if not node:
        return
    path = node.get("path")
    if path:
        flat_dict[path] = node.get("size", 0)
    
    # Recurse children
    for child in node.get("children", []):
        if child.get("is_dir", False):
            flatten_tree(child, flat_dict)

def compare_scan_files(current_file, bak_file):
    curr = load_json(current_file)
    prev = load_json(bak_file)
    
    if not curr:
        return f"Current scan file '{os.path.basename(current_file)}' not found."
    if not prev:
        return f"Previous backup file '{os.path.basename(bak_file)}' not found. Run a new scan first to create history."
        
    curr_info = curr.get("scan_info", {})
    prev_info = prev.get("scan_info", {})
    
    curr_size = curr_info.get("total_size", 0)
    prev_size = prev_info.get("total_size", 0)
    diff = curr_size - prev_size
    
    target = curr_info.get("target_path", "")
    
    report = []
    report.append(f"### 📍 Target: {target}")
    report.append(f"* **Current Size:** {format_abs_size(curr_size)}")
    report.append(f"* **Previous Size:** {format_abs_size(prev_size)}")
    report.append(f"* **Difference:** {format_size(diff)}")
    
    # Flatten trees to find folder changes
    curr_folders = {}
    prev_folders = {}
    flatten_tree(curr.get("tree"), curr_folders)
    flatten_tree(prev.get("tree"), prev_folders)
    
    folder_growth = []
    for path, c_size in curr_folders.items():
        p_size = prev_folders.get(path, 0)
        f_diff = c_size - p_size
        # Only report significant folder growth/shrinkage (> 20 MB)
        if abs(f_diff) > 20 * 1024 * 1024:
            folder_growth.append((path, f_diff, c_size))
            
    folder_growth.sort(key=lambda x: x[1], reverse=True)
    
    if folder_growth:
        report.append("\n#### 📂 Folders with Significant Growth:")
        # Top 5 growing folders
        growing = [x for x in folder_growth if x[1] > 0][:5]
        if growing:
            for path, f_diff, c_size in growing:
                report.append(f"  * `{path}`: {format_size(f_diff)} (Now: {format_abs_size(c_size)})")
        else:
            report.append("  * No significant folder growth found.")
            
        report.append("\n#### 📉 Folders with Significant Shrinkage:")
        # Top 5 shrinking folders (most negative diff first, so sort reverse=False)
        shrinking = sorted([x for x in folder_growth if x[1] < 0], key=lambda x: x[1])[:5]
        if shrinking:
            for path, f_diff, c_size in shrinking:
                report.append(f"  * `{path}`: {format_size(f_diff)} (Now: {format_abs_size(c_size)})")
        else:
            report.append("  * No significant folder shrinkage found.")
            
    # File level comparisons
    curr_files = {f["path"]: f["size"] for f in curr.get("top_large_files", [])}
    prev_files = {f["path"]: f["size"] for f in prev.get("top_large_files", [])}
    
    new_files = []
    for path, size in curr_files.items():
        if path not in prev_files:
            new_files.append((path, size))
            
    deleted_files = []
    for path, size in prev_files.items():
        if path not in curr_files:
            deleted_files.append((path, size))
            
    if new_files:
        report.append("\n#### ➕ New Large Files Detected:")
        for path, size in sorted(new_files, key=lambda x: x[1], reverse=True)[:5]:
            report.append(f"  * `{path}` ({format_abs_size(size)})")
            
    if deleted_files:
        report.append("\n#### ➖ Large Files Removed:")
        for path, size in sorted(deleted_files, key=lambda x: x[1], reverse=True)[:5]:
            report.append(f"  * `{path}` ({format_abs_size(size)})")
            
    return "\n".join(report)

def main():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    scan_files = [
        ("C_drive_results.json", "C_drive_results.json.bak"),
        ("D_drive_results.json", "D_drive_results.json.bak"),
        ("E_drive_results.json", "E_drive_results.json.bak"),
        ("F_drive_results.json", "F_drive_results.json.bak"),
        ("scan_results.json", "scan_results.json.bak")
    ]
    
    print("# Disk Space Growth Comparison Report\n")
    
    found_any = False
    for curr_name, bak_name in scan_files:
        curr_path = os.path.join(current_dir, curr_name)
        bak_path = os.path.join(current_dir, bak_name)
        
        if os.path.exists(curr_path) and os.path.exists(bak_path):
            found_any = True
            print(f"## Comparison for {curr_name}")
            report = compare_scan_files(curr_path, bak_path)
            print(report)
            print("\n" + "="*50 + "\n")
            
    if not found_any:
        print("No scan/backup pairs found to compare. Please run a scan twice (so that a backup is generated) before comparing.")

if __name__ == "__main__":
    main()
