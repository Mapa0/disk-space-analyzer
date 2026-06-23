import os
from PIL import Image

def main():
    png_path = r"C:\Users\marco\.gemini\antigravity\brain\7cad3295-2a36-42d4-9346-c5ce39a62032\app_icon_1782234523091.png"
    ico_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icon.ico")
    
    if not os.path.exists(png_path):
        print(f"Error: PNG icon not found at {png_path}")
        return
        
    print(f"Loading PNG icon from {png_path}...")
    try:
        img = Image.open(png_path)
        
        # Save as ICO with standard sizes
        sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
        img.save(ico_path, format="ICO", sizes=sizes)
        print(f"Successfully generated Windows icon: {ico_path}")
    except Exception as e:
        print(f"Error during icon conversion: {e}")

if __name__ == "__main__":
    main()
