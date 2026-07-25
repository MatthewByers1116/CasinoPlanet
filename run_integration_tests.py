import subprocess
import time
import os
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

def run():
    # Remove old report if it exists
    if os.path.exists("test_report.md"):
        try:
            os.remove("test_report.md")
        except OSError:
            pass

    # 1. Start server
    print("Starting serve.py...")
    server_proc = subprocess.Popen([sys.executable, "serve.py"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(2) # wait for server to spin up
    
    # 2. Launch chrome headlessly
    print("Launching Chrome in headless mode...")
    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    chrome_exe = "chrome"
    for p in chrome_paths:
        if os.path.exists(p):
            chrome_exe = p
            break
            
    print(f"Using Chrome path: {chrome_exe}")
    chrome_proc = subprocess.Popen([
        chrome_exe,
        "--headless=new",
        "--disable-gpu",
        "http://127.0.0.1:8000/test_runner.html"
    ])
    
    # 3. Wait for test_report.md to appear and be completed
    print("Waiting for tests to run (up to 60 seconds)...")
    success = False
    for i in range(60):
        time.sleep(1)
        if os.path.exists("test_report.md"):
            # Check if it has completed writing (should have detailed step logs)
            with open("test_report.md", "r", encoding="utf-8") as f:
                content = f.read()
                if "Detailed Step Logs" in content:
                    success = True
                    break
                    
    # 4. Clean up
    print("Cleaning up processes...")
    try:
        chrome_proc.terminate()
        chrome_proc.wait(timeout=2)
    except Exception:
        # Fallback taskkill on Windows
        subprocess.call(["taskkill", "/F", "/IM", "chrome.exe"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
    try:
        server_proc.terminate()
        server_proc.wait(timeout=2)
    except Exception:
        pass
    
    if success:
        print("\n==================================================")
        print("INTEGRATION TESTS PASSED SUCCESSFULLY!")
        print("==================================================\n")
        with open("test_report.md", "r", encoding="utf-8") as f:
            print(f.read())
    else:
        print("\n==================================================")
        print("ERROR: Tests timed out or failed to complete.")
        print("==================================================\n")
        sys.exit(1)

if __name__ == "__main__":
    run()
