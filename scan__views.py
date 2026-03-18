import os
import re

VIEWS_DIR = r"d:\odnixdeploy2\odnixdeploy\chat\views"

def find_views_to_refactor():
    for root, dirs, files in os.walk(VIEWS_DIR):
        for f in files:
            if f.endswith('.py'):
                filepath = os.path.join(root, f)
                with open(filepath, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                # Simple regex to find blocks of decorators
                # This finds defs with at least csrf_exempt and login_required before them
                pattern = r'((?:@[^\n]+\n)*)def ([a-zA-Z0-9_]+)\(request.*?\):'
                matches = re.finditer(pattern, content)
                for match in matches:
                    decorators = match.group(1)
                    func_name = match.group(2)
                    
                    if 'csrf_exempt' in decorators and 'login_required' in decorators:
                        print(f"{f}: {func_name}")

if __name__ == '__main__':
    find_views_to_refactor()
