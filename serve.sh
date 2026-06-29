#!/bin/sh
# Run this to serve the dashboard locally
# Then set http://localhost:8080 as your new tab URL
echo "Dashboard running at http://localhost:8080"
python3 -m http.server 8080 --bind 127.0.0.1
