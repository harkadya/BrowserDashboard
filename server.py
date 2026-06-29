#!/usr/bin/env python3
"""Dashboard server — static files + ICS/Reddit proxies (no dependencies)."""
import http.server, urllib.request, urllib.parse, os, sys, subprocess, json
import xml.etree.ElementTree as ET

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/proxy/reddit':
            qs  = urllib.parse.parse_qs(parsed.query)
            sub = qs.get('sub', [None])[0]
            if not sub or not sub.replace('_','').replace('-','').isalnum():
                self.send_error(400, 'Invalid subreddit')
                return
            try:
                # urllib gets TLS-fingerprinted by Reddit; curl works fine
                result = subprocess.run(
                    ['curl', '-s', '-L', '-A',
                     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                     f'https://www.reddit.com/r/{sub}.rss'],
                    capture_output=True, timeout=15
                )
                ns = {'a': 'http://www.w3.org/2005/Atom'}
                root = ET.fromstring(result.stdout)
                posts = []
                for entry in root.findall('a:entry', ns):
                    link = entry.find('a:link', ns)
                    cat  = entry.find('a:category', ns)
                    auth = entry.find('a:author/a:name', ns)
                    posts.append({
                        'title':     entry.findtext('a:title', '', ns),
                        'url':       link.get('href', '') if link is not None else '',
                        'subreddit': cat.get('label', '') if cat is not None else '',
                        'author':    auth.text.replace('/u/', '') if auth is not None and auth.text else '',
                        'updated':   entry.findtext('a:updated', '', ns),
                    })
                data = json.dumps(posts).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', 'http://localhost:8080')
                self.end_headers()
                self.wfile.write(data)
            except Exception as e:
                self.send_error(502, str(e))
        elif parsed.path == '/proxy/ics':
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
