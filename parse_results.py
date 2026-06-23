import json
import os

drives = ['C', 'D', 'E', 'F']

def format_bytes(bytes):
    if bytes == 0: return '0 B'
    k = 1024
    sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    i = 0
    while bytes >= k and i < len(sizes) - 1:
        bytes /= k
        i += 1
    return f"{bytes:.2f} {sizes[i]}"

report = []

for drive in drives:
    file_name = f"{drive}_drive_results.json"
    if not os.path.exists(file_name):
        report.append(f"Drive {drive}: No scan results found.\n")
        continue
        
    with open(file_name, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    info = data['scan_info']
    tree = data['tree']
    top_files = data['top_large_files']
    extensions = data['extension_stats']
    
    report.append("=========================================")
    report.append(f"DRIVE {drive}:\\")
    report.append(f"  Total Size: {format_bytes(info['total_size'])}")
    report.append(f"  Files: {info['total_files']:,} | Folders: {info['total_folders']:,}")
    report.append("-----------------------------------------")
    
    # Largest folders under root
    report.append("  LARGEST DIRECTORIES UNDER ROOT:")
    dirs = [c for c in tree.get('children', []) if c.get('is_dir')]
    # Sort just in case
    dirs.sort(key=lambda x: x['size'], reverse=True)
    for i, d in enumerate(dirs[:8]):
        report.append(f"    {i+1}. {d['name']} - {format_bytes(d['size'])} ({d['path']})")
        
    report.append("\n  LARGEST FILES ON DRIVE:")
    for i, f in enumerate(top_files[:8]):
        report.append(f"    {i+1}. {f['name']} - {format_bytes(f['size'])} ({f['path']})")
        
    report.append("\n  TOP FILE TYPES:")
    for i, ext in enumerate(extensions[:8]):
        report.append(f"    {i+1}. {ext['ext']} - {format_bytes(ext['size'])}")
    report.append("=========================================\n")

print("\n".join(report))
