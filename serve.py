import http.server
import socketserver
import socket
import sys

PORT = 8000
MAX_PORT_ATTEMPTS = 50

# Use ThreadingTCPServer to handle concurrent requests (e.g. loading style.css and multiple js files in parallel)
class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    pass

def find_free_port(start_port):
    port = start_port
    for _ in range(MAX_PORT_ATTEMPTS):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            port += 1
    return None

def start_server():
    free_port = find_free_port(PORT)
    if free_port is None:
        print("Error: Could not find any free port to host the server.")
        sys.exit(1)

    # Reuse socket address to make sure restarts release ports instantly
    socketserver.TCPServer.allow_reuse_address = True
    
    class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
        def do_POST(self):
            if self.path == '/save_report':
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                with open('test_report.md', 'wb') as f:
                    f.write(post_data)
                self.send_response(200)
                self.send_header('Content-type', 'text/plain')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(b'OK')
            else:
                self.send_response(404)
                self.end_headers()

    handler = CustomHTTPRequestHandler
    
    try:
        # Instantiate the threaded server
        with ThreadedTCPServer(('127.0.0.1', free_port), handler) as httpd:
            print("SERVER_STARTED_SUCCESSFULLY")
            print(f"Casino Planet is running at: http://localhost:{free_port}")
            sys.stdout.flush()
            httpd.serve_forever()
    except Exception as e:
        print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    start_server()
