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
        print(f"Warning: Error deleting {path}: {e} (might be locked by a running process)")

def clean_folder_contents_safely(folder_path):
    if not os.path.exists(folder_path):
        print(f"Folder does not exist: {folder_path} (already clean)")
        return
        
    print(f"Cleaning contents of: {folder_path}")
    for item in os.listdir(folder_path):
        item_path = os.path.join(folder_path, item)
        try:
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)
            else:
                os.remove(item_path)
        except Exception as e:
            # File is likely locked by a running app, ignore and continue
            pass
    print(f"Safe cleaning of {folder_path} complete.")

def main():
    print("=========================================")
    print("      STARTING DRIVE C:\ ROUND 3 CLEANUP ")
    print("=========================================\n")
    
    # 1. LM STUDIO (Exclusão total)
    print("--- Removing LM Studio ---")
    lm_data = r"C:\Users\marco\.lmstudio"
    lm_program = r"C:\Users\marco\AppData\Local\Programs\LM Studio"
    lm_updater = r"C:\Users\marco\AppData\Local\lm-studio-updater"
    for p in [lm_data, lm_program, lm_updater]:
        delete_path(p)
        
    # 2. VS CODE CACHES
    print("\n--- Cleaning VS Code Caches ---")
    vscode_code_dir = r"C:\Users\marco\AppData\Roaming\Code"
    vscode_cache_folders = [
        "Cache",
        "CachedConfigurations",
        "CachedData",
        "CachedExtensionVSIXs",
        "CachedProfilesData",
        "Code Cache",
        "DawnGraphiteCache",
        "DawnWebGPUCache",
        "GPUCache",
        r"User\workspaceStorage"
    ]
    for folder in vscode_cache_folders:
        p = os.path.join(vscode_code_dir, folder)
        delete_path(p)
        
    # 3. OTHER APPS (Minecraft, Roblox)
    print("\n--- Removing Minecraft and Roblox ---")
    minecraft = r"C:\Users\marco\AppData\Roaming\.minecraft"
    roblox = r"C:\Users\marco\AppData\Local\Roblox"
    delete_path(minecraft)
    delete_path(roblox)
    
    # 4. APP CACHES (Safe/locked handling)
    print("\n--- Cleaning Browser, Discord, Spotify & NVIDIA Caches ---")
    
    # Spotify Cache Data
    spotify_cache = r"C:\Users\marco\AppData\Local\Packages\SpotifyAB.SpotifyMusic_zpdnekdrzrea0\LocalCache\Spotify\Data"
    clean_folder_contents_safely(spotify_cache)
    
    # NVIDIA Shader Cache
    nvidia_dxcache = r"C:\Users\marco\AppData\Local\NVIDIA\DXCache"
    clean_folder_contents_safely(nvidia_dxcache)
    
    # Browser and Discord Caches
    cache_paths = [
        r"C:\Users\marco\AppData\Local\Google\Chrome\User Data\Default\Cache",
        r"C:\Users\marco\AppData\Local\Google\Chrome\User Data\Default\Code Cache",
        r"C:\Users\marco\AppData\Local\Microsoft\Edge\User Data\Default\Cache",
        r"C:\Users\marco\AppData\Local\Microsoft\Edge\User Data\Default\Code Cache",
        r"C:\Users\marco\AppData\Roaming\discord\Cache",
        r"C:\Users\marco\AppData\Roaming\discord\Code Cache"
    ]
    
    for path in cache_paths:
        clean_folder_contents_safely(path)
        
    print("\n=========================================")
    print("         ROUND 3 CLEANUP COMPLETED        ")
    print("=========================================")

if __name__ == "__main__":
    main()
