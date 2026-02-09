import os
from django.conf import settings
from django.http import HttpResponse
from django.views.static import serve

from django.views.decorators.csrf import ensure_csrf_cookie

@ensure_csrf_cookie
def serve_react(request, path=''):
    """
    Serves the React frontend (SPA).
    If the path matches a file in frontend/dist, serves that file.
    Otherwise, serves index.html.
    """
    dist_dir = os.path.join(settings.BASE_DIR, 'frontend', 'dist')
    
    # Normalize path
    if path.startswith('/'):
        path = path[1:]
        
    file_path = os.path.join(dist_dir, path)

    # 1. Try to serve exact file (assets, favicon, etc.)
    if path and os.path.exists(file_path) and os.path.isfile(file_path):
        return serve(request, path, document_root=dist_dir)

    # 2. Fallback to index.html for SPA routing
    # But carefully: don't double-handle if it looks like a missing resource (e.g. .js or .css)
    # Actually, for SPA, we usually WANT to return index.html for unknown routes, 
    # but for missing assets we might want 404. 
    # Simple heuristic: if it has an extension, return 404 (let serve handle/fail it? No, serve handles existence).
    # If it doesn't exist and has extension, let's assume it's a 404.
    if '.' in path and not path.endswith('.html'):
         # It looked like a file request but wasn't found above.
         # Unless it is a route like /user.name? No, routes usually don't have dots or are specific.
         # For simplicity, let's just serve index.html for everything non-static.
         pass

    index_path = os.path.join(dist_dir, 'index.html')
    if os.path.exists(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read())
    else:
        return HttpResponse(
            "React frontend not built. Please run 'npm run build' in the frontend directory.",
            status=503
        )
