import http.server
import json
import threading
import os
import sys
from datetime import datetime
import run_scheduled_scans

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

def get_data_dir():
    if hasattr(sys, '_MEIPASS'):
        # Running as PyInstaller executable; persist scan results next to the exe
        return os.path.dirname(sys.executable)
    else:
        # Running as python script; persist in the script folder
        return os.path.dirname(os.path.abspath(__file__))

def run_scan():
    global IS_SCANNING
    print("Background scan started...")
    try:
        run_scheduled_scans.main()
        print("Background scan finished successfully.")
    except Exception as e:
        print(f"Error during background scan: {e}")
    finally:
        with SCAN_LOCK:
            IS_SCANNING = False

def get_scans_info():
    data_dir = get_data_dir()
    info = {}
    info["__data_dir__"] = os.path.abspath(data_dir)
    for filename, label in SCAN_FILES.items():
        filepath = os.path.join(data_dir, filename)
        if os.path.exists(filepath):
            try:
                stat = os.stat(filepath)
                mtime = stat.st_mtime
                dt = datetime.fromtimestamp(mtime).isoformat()
                
                # Try to load summary size and counts
                total_size = 0
                total_files = 0
                total_folders = 0
                target_path = ""
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    scan_info = data.get("scan_info", {})
                    total_size = scan_info.get("total_size", 0)
                    total_files = scan_info.get("total_files", 0)
                    total_folders = scan_info.get("total_folders", 0)
                    target_path = scan_info.get("target_path", "")
                
                info[filename] = {
                    "label": label,
                    "target_path": target_path,
                    "timestamp": dt,
                    "mtime": mtime,
                    "total_size": total_size,
                    "total_files": total_files,
                    "total_folders": total_folders,
                    "absolute_path": os.path.abspath(filepath)
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
            # Intercept scan results JSON requests to serve from the persistent data directory
            clean_path = self.path.lstrip('/')
            if clean_path in SCAN_FILES:
                data_dir = get_data_dir()
                filepath = os.path.join(data_dir, clean_path)
                if os.path.exists(filepath):
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    with open(filepath, 'rb') as f:
                        self.wfile.write(f.read())
                    return
            
            # Fallback to static web assets (served from sys._MEIPASS or local workspace folder)
            super().do_GET()

def main():
    if hasattr(sys, '_MEIPASS'):
        current_dir = sys._MEIPASS
    else:
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
