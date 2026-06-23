import os
import sys
import threading
import time
import webview

# Add current folder to path to ensure we can import server
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

import server

def main():
    # 1. Start the Python server in a background daemon thread
    server_thread = threading.Thread(target=server.main, daemon=True)
    server_thread.start()
    
    # 2. Wait a moment for the server to start up
    time.sleep(0.5)
    
    # 3. Path to the icon file
    icon_path = os.path.join(current_dir, "icon.ico")
    if not os.path.exists(icon_path):
        icon_path = None
        
    # 4. Open the standalone native webview window
    webview.create_window(
        title="Disk Space Analyzer",
        url=f"http://localhost:{server.PORT}",
        width=1350,
        height=850,
        min_size=(1024, 768),
        background_color="#0b0c10"
    )
    
    # 5. Start the webview main loop (this blocks until the window is closed)
    webview.start(icon=icon_path)

if __name__ == "__main__":
    main()
