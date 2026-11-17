#!/usr/bin/env python3
"""Local server for Ann Arbor in 3D.

Serves the site and saves your reviews and building names to data/my-data.json,
so they survive reloads, browser resets and switching browsers.

    python3 server.py          # then open http://localhost:8642
    python3 server.py 9000     # use another port

Listens on 127.0.0.1 only, so nothing outside this computer can reach it.
"""
import json
import os
import sys
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "my-data.json"
MAX_BYTES = 5_000_000
EMPTY = {"version": 1, "reviews": {}, "buildings": []}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Always serve the latest files rather than a stale browser copy.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/data":
            try:
                data = json.loads(DATA.read_text()) if DATA.exists() else EMPTY
            except (OSError, ValueError):
                return self.send_json(500, {"error": "data/my-data.json could not be read"})
            return self.send_json(200, data)
        if self.path.split("?")[0].startswith("/data/"):
            return self.send_json(404, {"error": "not found"})  # read it through /api/data
        return super().do_GET()

    def do_PUT(self):
        if self.path.split("?")[0] != "/api/data":
            return self.send_json(404, {"error": "not found"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BYTES:
            return self.send_json(413, {"error": "bad size"})
        try:
            data = json.loads(self.rfile.read(length))
            if not (isinstance(data, dict) and isinstance(data.get("reviews"), dict)
                    and isinstance(data.get("buildings"), list)):
                raise ValueError("unexpected shape")
        except ValueError as err:
            return self.send_json(400, {"error": str(err)})
        DATA.parent.mkdir(exist_ok=True)
        # Write to a temp file and rename, so a crash never leaves a half-written file.
        fd, tmp = tempfile.mkstemp(dir=DATA.parent, suffix=".tmp")
        with os.fdopen(fd, "w") as fh:
            json.dump(data, fh, indent=1, ensure_ascii=False)
        os.replace(tmp, DATA)
        return self.send_json(200, {"ok": True})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8642
    print(f"Ann Arbor in 3D: http://localhost:{port}  (saving to {DATA.relative_to(ROOT)})")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
