#!/usr/bin/env python3
"""Dashboard server — static files + ICS proxy (no dependencies)."""
import http.server, urllib.request, urllib.parse, os, sys

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/proxy/ics':
            qs = urllib.parse.parse_qs(parsed.query)
            url = qs.get('url', [None])[0]
            if not url or not url.startswith('https://calendar.google.com/'):
                self.send_error(400, 'Only Google Calendar ICS URLs allowed')
                return
            try:
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=10) as r:
                    data = r.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/calendar; charset=utf-8')
                self.send_header('Access-Control-Allow-Origin', 'http://localhost:8080')
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_error(502, str(e))
        else:
            super().do_GET()

    def log_message(self, fmt, *args):
        pass  # quiet

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    with http.server.HTTPServer(('127.0.0.1', port), Handler) as httpd:
        print(f'Dashboard → http://localhost:{port}')
        httpd.serve_forever()
