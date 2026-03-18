import os
import re

view_dir = r"d:\odnixdeploy2\odnixdeploy\chat\views"
api_endpoints = []

# Regex patterns for various decorators
# We want to find function-based views that are likely APIs
# Examples: @csrf_exempt, @login_required, @require_POST, @require_http_methods
decorator_pattern = r'@(?:csrf_exempt|login_required|require_POST|require_http_methods|ensure_csrf_cookie|api_view).*?'
func_pattern = r'def\s+(\w+)\s*\(request'

for filename in os.listdir(view_dir):
    if filename.endswith(".py") and filename != "__init__.py":
        filepath = os.path.join(view_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
            content = "".join(lines)
            
            # Find all function definitions and their preceding lines (for decorators)
            # This is simpler: just scan line by line for 'def ' and look back for decorators
            for i, line in enumerate(lines):
                if line.lstrip().startswith("def "):
                    match = re.search(r'def\s+(\w+)\s*\(request', line)
                    if match:
                        func_name = match.group(1)
                        # Check previous 5 lines for decorators
                        decs = []
                        for j in range(max(0, i-5), i):
                            if lines[j].strip().startswith("@"):
                                decs.append(lines[j].strip())
                        
                        api_endpoints.append({
                            "file": filename,
                            "name": func_name,
                            "decorators": decs,
                            "line": i + 1
                        })

with open(r"d:\odnixdeploy2\odnixdeploy\scripts\api_endpoints_list.txt", "w", encoding="utf-8") as f:
    for endpoint in api_endpoints:
        # Heuristic: if it has @csrf_exempt or starts with api_ or is in a file like chat_api.py, it's an API
        is_api = any("@csrf_exempt" in d or "@api_view" in d or "@login_required" in d or "@require_POST" in d or "@require_http_methods" in d for d in endpoint['decorators'])
        if not is_api and (endpoint['name'].startswith("api_") or endpoint['file'] in ['chat_api.py', 'read_receipts.py', 'share_api.py', 'message_context.py']):
            is_api = True
            
        if is_api:
            f.write(f"{endpoint['file']}:{endpoint['line']} {endpoint['name']} decs: {endpoint['decorators']}\n")
