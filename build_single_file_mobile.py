import os
import re

def build_single_file():
    print("Building standalone CasinoPlanetMobile.html...")
    project_dir = os.path.dirname(os.path.abspath(__file__))
    index_path = os.path.join(project_dir, "mobile.html")
    
    if not os.path.exists(index_path):
        print(f"Error: mobile.html not found in {project_dir}")
        return
        
    with open(index_path, "r", encoding="utf-8") as f:
        html_content = f.read()
        
    # 1. Inline CSS
    css_tag_pattern = r'<link rel="stylesheet" href="src/style.css">'
    css_path = os.path.join(project_dir, "src", "style.css")
    if os.path.exists(css_path):
        print("Inlining style.css...")
        with open(css_path, "r", encoding="utf-8") as f:
            css_content = f.read()
        inlined_css = f"<style>\n{css_content}\n</style>"
        html_content = re.sub(css_tag_pattern, inlined_css, html_content)
    else:
        print("Warning: src/style.css not found!")

    # 2. Inline Javascript files
    script_pattern = r'<script src="([^"]+)"></script>'
    
    def replace_script(match):
        rel_path = match.group(1)
        normalized_rel_path = rel_path.replace("/", os.sep)
        full_path = os.path.join(project_dir, normalized_rel_path)
        
        if os.path.exists(full_path):
            print(f"Inlining script: {rel_path}")
            with open(full_path, "r", encoding="utf-8") as sf:
                script_content = sf.read()
            return f"<script>\n// --- INLINED FROM {rel_path} ---\n{script_content}\n</script>"
        else:
            print(f"Error: Script file not found: {rel_path}")
            return match.group(0)
            
    html_content = re.sub(script_pattern, replace_script, html_content)
    
    # Write output
    output_path = os.path.join(project_dir, "CasinoPlanetMobile.html")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    print(f"SUCCESS: Standalone mobile game packaged successfully at: {output_path}")

if __name__ == "__main__":
    build_single_file()
