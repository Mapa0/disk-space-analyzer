import json
import os
import sys

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

current_dir = r"C:\Users\admin\.gemini\antigravity\scratch\disk-analyzer"
scan_file = os.path.join(current_dir, "C_drive_results.json")

def format_size(size_bytes):
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(units) - 1:
        size_bytes /= 1024
        i += 1
    return f"{size_bytes:.2f} {units[i]}"

def find_node(node, target_path):
    if not node:
        return None
    path = node.get("path", "")
    if path.lower() == target_path.lower():
        return node
    for child in node.get("children", []):
        res = find_node(child, target_path)
        if res:
            return res
    return None

def print_node_children(node, title, limit=25):
    if not node:
        print(f"\n{title} (Not found in scan data)")
        return
        
    children = node.get("children", [])
    print(f"\n=========================================")
    print(f"{title} ({format_size(node.get('size', 0))} total)")
    print(f"=========================================")
    
    # Sort children by size descending
    sorted_children = sorted(children, key=lambda x: x.get("size", 0), reverse=True)
    
    printed = 0
    for child in sorted_children:
        name = child.get("name", "")
        size = child.get("size", 0)
        is_dir = child.get("is_dir", False)
        
        type_str = "📂" if is_dir else "📄"
        print(f"  {type_str} {name} : {format_size(size)}")
        printed += 1
        if printed >= limit:
            break

def main():
    if not os.path.exists(scan_file):
        print(f"Scan file '{scan_file}' not found.")
        return
        
    print("Loading scan data...")
    with open(scan_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    tree = data.get("tree", {})
    
    # 1. Inspect WindowsApps
    wa_node = find_node(tree, r"C:\Program Files\WindowsApps")
    print_node_children(wa_node, "DETALHAMENTO DE WINDOWSAPPS", limit=20)
    
    # 2. Inspect User marco
    user_node = find_node(tree, r"C:\Users\marco")
    print_node_children(user_node, "DETALHAMENTO DE C:\\Users\\marco (Raiz)", limit=15)
    
    # 3. Inspect HACKING workspace
    hacking_node = find_node(tree, r"C:\Users\marco\HACKING")
    print_node_children(hacking_node, "DETALHAMENTO DE HACKING WORKSPACE", limit=15)
    
    # 4. Inspect Local AppData
    local_node = find_node(tree, r"C:\Users\marco\AppData\Local")
    print_node_children(local_node, "DETALHAMENTO DE AppData\\Local", limit=15)
    
    # 5. Inspect Roaming AppData
    roaming_node = find_node(tree, r"C:\Users\marco\AppData\Roaming")
    print_node_children(roaming_node, "DETALHAMENTO DE AppData\\Roaming", limit=15)
    
    # 6. Inspect OneDrive folder
    od_node = find_node(tree, r"C:\Users\marco\OneDrive")
    print_node_children(od_node, "DETALHAMENTO DE OneDrive", limit=15)

if __name__ == "__main__":
    main()
