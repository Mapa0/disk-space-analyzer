import os
import shutil

def delete_path(path):
    if not os.path.exists(path):
        print(f"Path does not exist: {path} (already clean)")
        return
        
    print(f"Deleting: {path}")
    try:
        if os.path.isdir(path):
            shutil.rmtree(path)
            print(f"Successfully deleted directory: {path}")
        else:
            os.remove(path)
            print(f"Successfully deleted file: {path}")
    except Exception as e:
        print(f"Error deleting {path}: {e}")

def main():
    print("=========================================")
    print("      STARTING DRIVE C:\ EXTRA CLEANUP   ")
    print("=========================================\n")
    
    # 1. Pip Cache
    pip_cache = r"C:\Users\marco\AppData\Local\pip\cache"
    delete_path(pip_cache)
    
    # 2. Npm Cache
    npm_cache = r"C:\Users\marco\AppData\Local\npm-cache"
    delete_path(npm_cache)
    
    # 3. NVIDIA Update/Installer caches
    nvidia_paths = [
        r"C:\ProgramData\NVIDIA Corporation\NVIDIA App\UpdateFramework\ota-artifacts",
        r"C:\ProgramData\NVIDIA Corporation\Downloader",
        r"C:\ProgramData\NVIDIA Corporation\NetService"
    ]
    for np in nvidia_paths:
        delete_path(np)
        
    # 4. LM Studio Updater
    lm_updater = r"C:\Users\marco\AppData\Local\lm-studio-updater"
    delete_path(lm_updater)
    
    # 5. Balena Etcher Cache
    balena_cache = r"C:\Users\marco\AppData\Local\balena_etcher"
    delete_path(balena_cache)
    
    # 6. DaVinci Resolve Support logs LogArchive
    davinci_logs = r"C:\Users\marco\AppData\Roaming\Blackmagic Design\DaVinci Resolve\Support\logs\LogArchive"
    delete_path(davinci_logs)
    
    # 7. HuggingFace Cache
    hf_cache = r"C:\Users\marco\.cache\huggingface"
    delete_path(hf_cache)
    
    print("\n=========================================")
    print("        EXTRA CLEANUP COMPLETED          ")
    print("=========================================")

if __name__ == "__main__":
    main()
