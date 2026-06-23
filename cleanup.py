import os
import shutil
import re

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

def delete_steam_game(game_name):
    # 1. Delete the game folder
    common_path = os.path.join(r"F:\SteamLibrary\steamapps\common", game_name)
    delete_path(common_path)
    
    # 2. Delete the manifest file (.acf)
    steamapps_path = r"F:\SteamLibrary\steamapps"
    if os.path.exists(steamapps_path):
        for item in os.listdir(steamapps_path):
            if item.startswith("appmanifest_") and item.endswith(".acf"):
                acf_path = os.path.join(steamapps_path, item)
                try:
                    with open(acf_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    # Look for the installdir name in the acf file (e.g., "installdir"   "TEKKEN 8")
                    match_dir = re.search(r'"installdir"\s+"([^"]+)"', content, re.IGNORECASE)
                    match_name = re.search(r'"name"\s+"([^"]+)"', content, re.IGNORECASE)
                    
                    is_match = False
                    if match_dir and match_dir.group(1).lower() == game_name.lower():
                        is_match = True
                    elif match_name and match_name.group(1).lower() == game_name.lower():
                        is_match = True
                    
                    if is_match:
                        print(f"Found and deleting Steam manifest: {acf_path} for game '{game_name}'")
                        os.remove(acf_path)
                except Exception as e:
                    print(f"Error checking manifest {item}: {e}")

def clean_folder_contents(folder_path):
    if not os.path.exists(folder_path):
        print(f"Folder does not exist: {folder_path}")
        return
        
    print(f"Cleaning contents of: {folder_path}")
    for item in os.listdir(folder_path):
        item_path = os.path.join(folder_path, item)
        delete_path(item_path)

def main():
    print("=========================================")
    print("         STARTING SYSTEM CLEANUP         ")
    print("=========================================\n")
    
    # --- DRIVE C CLEANUP ---
    print("--- Cleaning Drive C: ---")
    
    # 1. Error Crash Dump
    dmp_file = r"C:\Windows\LiveKernelReports\ResourceTimeout-20260331-1352.dmp"
    delete_path(dmp_file)
    
    # 2. LM Studio Models
    lm_models_dir = r"C:\Users\marco\.lmstudio\models"
    # Delete the models directory entirely
    delete_path(lm_models_dir)
    
    # 3. Hytale installation files
    hytale_dir = r"C:\Users\marco\AppData\Roaming\Hytale"
    delete_path(hytale_dir)
    
    # 4. Python/uv Cache
    uv_cache_dir = r"C:\Users\marco\AppData\Local\uv\cache"
    delete_path(uv_cache_dir)
    
    print("\n--- Drive C: Cleaning Complete ---\n")
    
    # --- DRIVE F CLEANUP ---
    print("--- Cleaning Drive F: ---")
    
    # 1. Bianca Work Render Previews (Delete contents but keep folder)
    previews_dir = r"F:\Bianca Work\Adobe Premiere Pro Video Previews"
    clean_folder_contents(previews_dir)
    
    # 2. Steam Games to Uninstall
    games_to_remove = [
        "TEKKEN 8",
        "Superfighters Deluxe",
        "Portal",
        "Portal 2",
        "Deep Rock Galactic",
        "Risk of Rain 2"
    ]
    
    for game in games_to_remove:
        print(f"\nUninstalling game: {game}")
        delete_steam_game(game)
        
    print("\n--- Drive F: Cleaning Complete ---\n")
    print("=========================================")
    print("           CLEANUP COMPLETED             ")
    print("=========================================")

if __name__ == "__main__":
    main()
