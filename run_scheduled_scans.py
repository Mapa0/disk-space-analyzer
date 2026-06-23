import os
import shutil
import sys
import json

# Ensure we can import scanner from the same directory
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from scanner import DiskScanner

# Define scans: { output_filename: target_path }
SCANS = {
    "C_drive_results.json": "C:\\",
    "D_drive_results.json": "D:\\",
    "E_drive_results.json": "E:\\",
    "F_drive_results.json": "F:\\",
    "scan_results.json": os.path.expanduser("~") # Home User directory
}

def get_data_dir():
    if hasattr(sys, '_MEIPASS'):
        return os.path.dirname(sys.executable)
    else:
        return os.path.dirname(os.path.abspath(__file__))

def main():
    print("--- Starting Scheduled Disk Scans ---")
    data_dir = get_data_dir()
    
    for filename, path in SCANS.items():
        if not os.path.exists(path):
            print(f"Path {path} does not exist. Skipping.")
            continue
            
        output_path = os.path.join(data_dir, filename)
        bak_path = output_path + ".bak"
        
        # 1. Rotate previous scan file to .bak for comparison
        if os.path.exists(output_path):
            try:
                # Copy instead of move, so if the scan fails, the original is still there
                shutil.copy2(output_path, bak_path)
                print(f"Created backup of previous scan: {filename}.bak")
            except Exception as e:
                print(f"Failed to create backup of {filename}: {e}")
                
        # 2. Perform the scan
        print(f"Scanning {path}...")
        try:
            # We use depth=6 to get good details for the folder tree
            scanner = DiskScanner(path, max_depth=6)
            results = scanner.scan()
            
            # Save the new scan results
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            print(f"Scan complete. Saved to: {filename}\n")
        except Exception as e:
            print(f"Error scanning {path}: {e}\n")
            
    print("--- All Scans Completed ---")

if __name__ == "__main__":
    main()
