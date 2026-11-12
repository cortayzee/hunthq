#!/usr/bin/env python3
"""Stamp every local JS/CSS reference with ?v=<version> so browsers never mix cached old and new modules.

GitHub Pages serves files with a ~10 minute cache; ES modules are cached one file at a time, so after a deploy a phone
can end up with new main.js + old util.js and fail to load views. Run this before every commit that ships code:
    python3 scripts/bump_version.py
"""
import re, subprocess, time, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
ver = time.strftime('%Y%m%d%H%M%S')
try:
    ver += '-' + subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], cwd=root, text=True).strip()
except Exception:
    pass

js_ref = re.compile(r"""((?:from|import)\s*\(?\s*['"])(\.{1,2}/[^'"?]+\.js)(?:\?v=[^'"]*)?(['"])""")
html_ref = re.compile(r"""((?:src|href)=")((?:js|css)/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?(")""")

changed = 0
for f in list((root / 'js').rglob('*.js')):
    s = f.read_text(); n = js_ref.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}", s)
    if n != s: f.write_text(n); changed += 1
idx = root / 'index.html'
s = idx.read_text(); n = html_ref.sub(lambda m: f"{m.group(1)}{m.group(2)}?v={ver}{m.group(3)}", s)
if n != s: idx.write_text(n); changed += 1
(root / 'js' / 'version.txt').write_text(ver + '\n')
print(f'version {ver}: updated {changed} files')
