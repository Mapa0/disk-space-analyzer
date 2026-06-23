import http.server
import json
import threading
import subprocess
import os
import sys
from datetime import datetime

PORT = 8000
IS_SCANNING = False
SCAN_LOCK = threading.Lock()

# Define scan files list
SCAN_FILES = {
    "C_drive_results.json": "Drive C:\\",
    "D_drive_results.json": "Drive D:\\",
    "E_drive_results.json": "Drive E:\\",
    "F_drive_results.json": "Drive F:\\",
    "scan_results.json": "Home User"
}

def run_scan():
    global IS_SCANNING
    current_dir = os.path.dirname(os.path.abspath(__file__))
    script_path = os.path.join(current_dir, "run_scheduled_scans.py")
    
    print("Background scan started...")
    try:
        # Run python run_scheduled_scans.py
        result = subprocess.run([sys.executable, script_path], capture_output=True, text=True, check=True)
        print("Background scan finished successfully.")
        print(result.stdout)
    except Exception as e:
        print(f"Error during background scan: {e}")
        if hasattr(e, 'stderr') and e.stderr:
            print(e.stderr)
    finally:
        with SCAN_LOCK:
            IS_SCANNING = False

def get_scans_info():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    info = {}
    for filename, label in SCAN_FILES.items():
        filepath = os.path.join(current_dir, filename)
        if os.path.exists(filepath):
            try:
                stat = os.stat(filepath)
                mtime = stat.st_mtime
                dt = datetime.fromtimestamp(mtime).isoformat()
                
                # Try to load summary size and counts
                total_size = 0
                total_files = 0
                total_folders = 0
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    scan_info = data.get("scan_info", {})
                    total_size = scan_info.get("total_size", 0)
                    total_files = scan_info.get("total_files", 0)
                    total_folders = scan_info.get("total_folders", 0)
                
                info[filename] = {
                    "label": label,
                    "timestamp": dt,
                    "mtime": mtime,
                    "total_size": total_size,
                    "total_files": total_files,
                    "total_folders": total_folders
                }
            except Exception as e:
                print(f"Error reading metadata from {filename}: {e}")
    return info

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        global IS_SCANNING
        if self.path == '/api/scan':
            response_data = {}
            status_code = 200
            
            with SCAN_LOCK:
                if IS_SCANNING:
                    status_code = 400
                    response_data = {"status": "error", "message": "A scan is already in progress."}
                else:
                    IS_SCANNING = True
                    # Spawn the scanner thread
                    threading.Thread(target=run_scan).start()
                    response_data = {"status": "success", "message": "Scan started in background."}
            
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        global IS_SCANNING
        if self.path == '/api/scan/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            with SCAN_LOCK:
                response = {"scanning": IS_SCANNING}
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        elif self.path == '/api/scans/info':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = get_scans_info()
            self.wfile.write(json.dumps(response).encode('utf-8'))
            
        else:
            # Fallback to static files
            super().do_GET()

def main():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(current_dir)
    
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, CustomHandler)
    print(f"Disk Space Analyzer server running at http://localhost:{PORT} ...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()

if __name__ == '__main__':
    main()
