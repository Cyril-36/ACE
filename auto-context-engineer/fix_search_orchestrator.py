#!/usr/bin/env python3
"""
Script to fix errors in the searchOrchestrator.ts file
"""

import re
import os
from pathlib import Path

def fix_search_orchestrator():
    """Fix errors in searchOrchestrator.ts"""
    project_path = "/Users/cyril/Desktop/ACE/auto-context-engineer"
    file_path = os.path.join(project_path, "src/services/search/searchOrchestrator.ts")
    
    if not os.path.exists(file_path):
        print(f"Error: File not found: {file_path}")
        return
    
    try:
        # Read file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # 1. Fix duplicate identifier '_name'
        # Split into lines to handle more precisely
        lines = content.split('\n')
        seen_name = False
        
        for i, line in enumerate(lines):
            if '_name:' in line and 'string' in line and '=' in line:
                if seen_name:
                    # Remove the duplicate line
                    lines[i] = f"  // Removed duplicate: {line}"
                else:
                    seen_name = True
        
        content = '\n'.join(lines)
        
        # 2. Fix unused 'metrics' variable
        metrics_pattern = r'(\s+)const\s+metrics\s*=\s*(.*?);\s*\n'
        content = re.sub(metrics_pattern, r'\1const _metrics = \2;\n', content)
        
        # 3. Fix '_search' to 'search' references
        content = re.sub(r'_search\(', r'search(', content)
        
        # 4. Fix '_metrics' to 'metrics' references
        content = re.sub(r'\._metrics', r'.metrics', content)
        content = re.sub(r'this._metrics', r'this.metrics', content)
        
        # Write changes if any were made
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Fixed errors in: {file_path}")
        else:
            print("No changes needed for searchOrchestrator.ts")
    
    except Exception as e:
        print(f"Error fixing searchOrchestrator.ts: {e}")

if __name__ == "__main__":
    fix_search_orchestrator()
    print("\n✅ searchOrchestrator.ts fixing complete!")
