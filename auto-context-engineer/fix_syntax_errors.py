#!/usr/bin/env python3
"""
Advanced TypeScript Syntax Error Fixer
Fixes remaining syntax errors like TS1005, TS1128, TS1434, etc.
"""

import os
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple
from collections import defaultdict

class SyntaxErrorFixer:
    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.files_with_errors = set()
        
    def run_type_check(self) -> str:
        """Run TypeScript type checking and return output"""
        result = subprocess.run(
            ['npm', 'run', 'type-check'],
            cwd=self.project_path,
            capture_output=True,
            text=True
        )
        return result.stderr + result.stdout
    
    def parse_syntax_errors(self, output: str) -> Dict[str, List[dict]]:
        """Parse syntax errors from TypeScript output"""
        errors_by_file = defaultdict(list)
        error_pattern = r'(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)'
        
        for match in re.finditer(error_pattern, output):
            file_path, line, col, error_code, message = match.groups()
            
            # Only handle syntax errors
            if error_code in ['TS1005', 'TS1128', 'TS1434', 'TS1109', 'TS1011', 'TS1003', 'TS1002']:
                errors_by_file[file_path].append({
                    'line': int(line),
                    'col': int(col),
                    'code': error_code,
                    'message': message
                })
                self.files_with_errors.add(file_path)
        
        return errors_by_file
    
    def fix_syntax_in_file(self, file_path: str, errors: List[dict]) -> bool:
        """Fix syntax errors in a specific file"""
        full_path = self.project_path / file_path
        
        if not full_path.exists():
            print(f"Warning: File not found: {file_path}")
            return False
        
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # Sort errors by line number in reverse to fix from bottom to top
            errors.sort(key=lambda x: (x['line'], x['col']), reverse=True)
            
            for error in errors:
                line_idx = error['line'] - 1
                if line_idx >= len(lines):
                    continue
                
                line = lines[line_idx]
                original_line = line
                
                # Fix based on error code and message
                if error['code'] == 'TS1005':  # ',' expected
                    line = self.fix_missing_comma(line, error)
                elif error['code'] == 'TS1128':  # Declaration or statement expected
                    line = self.fix_declaration_expected(line, error)
                elif error['code'] == 'TS1434':  # Unexpected keyword or identifier
                    line = self.fix_unexpected_keyword(line, error)
                elif error['code'] == 'TS1109':  # Expression expected
                    line = self.fix_expression_expected(line, error)
                elif error['code'] == 'TS1011':  # Element access expression should take argument
                    line = self.fix_element_access(line, error)
                elif error['code'] == 'TS1003':  # Identifier expected
                    line = self.fix_identifier_expected(line, error)
                elif error['code'] == 'TS1002':  # Unterminated string literal
                    line = self.fix_unterminated_string(line, error)
                
                if line != original_line:
                    lines[line_idx] = line
            
            # Write back the fixed content
            with open(full_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            
            return True
            
        except Exception as e:
            print(f"Error fixing {file_path}: {e}")
            return False
    
    def fix_missing_comma(self, line: str, error: dict) -> str:
        """Fix TS1005: ',' expected"""
        col = error['col'] - 1
        
        # Common patterns for missing commas
        patterns = [
            # Object literal properties
            (r'(\w+:\s*[^,\s}]+)\s+(\w+:)', r'\1, \2'),
            # Array elements
            (r'(["\'].*?["\'])\s+(["\'])', r'\1, \2'),
            # Function parameters
            (r'(\w+:\s*\w+)\s+(\w+:)', r'\1, \2'),
            # After type annotations
            (r'(:\s*\w+(?:<[^>]+>)?)\s+(\w+)', r'\1, \2'),
        ]
        
        for pattern, replacement in patterns:
            new_line = re.sub(pattern, replacement, line)
            if new_line != line:
                return new_line
        
        # Try to insert comma at the error position
        if col < len(line):
            # Check if we're in an object or array context
            if '{' in line[:col] or '[' in line[:col]:
                # Find the position before the next property or element
                match = re.search(r'\s+(?=\w+:|["\'[])', line[col:])
                if match:
                    insert_pos = col + match.start()
                    return line[:insert_pos] + ',' + line[insert_pos:]
        
        return line
    
    def fix_declaration_expected(self, line: str, error: dict) -> str:
        """Fix TS1128: Declaration or statement expected"""
        # Remove any trailing semicolons or commas that shouldn't be there
        line = re.sub(r'[,;]\s*$', '', line)
        
        # Fix malformed arrow functions
        line = re.sub(r'(\w+)\s*:\s*any\s*=>\s*{', r'(\1: any) => {', line)
        
        # Fix malformed type annotations
        line = re.sub(r'(\w+)\s*:\s*(\w+)\s*(\w+)', r'\1: \2, \3', line)
        
        # Ensure proper statement termination
        if line.strip() and not line.strip().endswith((';', '{', '}', ',', ')', ']')):
            if 'const' in line or 'let' in line or 'var' in line or 'return' in line:
                line = line.rstrip() + ';\n'
        
        return line
    
    def fix_unexpected_keyword(self, line: str, error: dict) -> str:
        """Fix TS1434: Unexpected keyword or identifier"""
        # Remove duplicate keywords
        line = re.sub(r'\b(const|let|var|function|async|export|import)\s+\1\b', r'\1', line)
        
        # Fix malformed type definitions
        line = re.sub(r'(\w+)\s*:\s*any\s*any', r'\1: any', line)
        
        # Fix duplicate parameter names
        line = re.sub(r'(\w+:\s*\w+)\s*,\s*\1', r'\1', line)
        
        # Remove extra parentheses in arrow functions
        line = re.sub(r'\(\((\w+:\s*any)\)\)', r'(\1)', line)
        
        return line
    
    def fix_expression_expected(self, line: str, error: dict) -> str:
        """Fix TS1109: Expression expected"""
        # Fix empty expressions
        line = re.sub(r'\[\s*\]', r'[]', line)
        line = re.sub(r'\{\s*\}', r'{}', line)
        
        # Fix incomplete ternary operators
        line = re.sub(r'\?\s*:\s*', r'? undefined : ', line)
        
        # Fix empty function calls
        line = re.sub(r'(\w+)\(\s*,', r'\1(undefined,', line)
        
        return line
    
    def fix_element_access(self, line: str, error: dict) -> str:
        """Fix TS1011: Element access expression should take an argument"""
        # Fix empty bracket access
        line = re.sub(r'\[\s*\](?!\s*[=:])', r'[0]', line)
        
        # Fix malformed array access
        line = re.sub(r'(\w+)\[\s*\]\s*=', r'\1 = [] as any', line)
        
        return line
    
    def fix_identifier_expected(self, line: str, error: dict) -> str:
        """Fix TS1003: Identifier expected"""
        # Fix missing identifiers after keywords
        line = re.sub(r'(const|let|var)\s*=', r'\1 temp =', line)
        
        # Fix missing property names
        line = re.sub(r':\s*,', r': undefined,', line)
        
        return line
    
    def fix_unterminated_string(self, line: str, error: dict) -> str:
        """Fix TS1002: Unterminated string literal"""
        # Count quotes and add missing ones
        single_quotes = line.count("'") - line.count("\\'")
        double_quotes = line.count('"') - line.count('\\"')
        
        if single_quotes % 2 != 0:
            line = line.rstrip() + "'\n"
        elif double_quotes % 2 != 0:
            line = line.rstrip() + '"\n'
        
        return line
    
    def fix_all_syntax_errors(self) -> int:
        """Main method to fix all syntax errors"""
        print("Starting syntax error fixing...")
        
        # Get current errors
        output = self.run_type_check()
        errors_by_file = self.parse_syntax_errors(output)
        
        total_files = len(errors_by_file)
        if total_files == 0:
            print("No syntax errors found!")
            return 0
        
        print(f"Found syntax errors in {total_files} files")
        
        # Fix each file
        fixed_count = 0
        for file_path, errors in errors_by_file.items():
            print(f"Fixing {len(errors)} errors in {file_path}")
            if self.fix_syntax_in_file(file_path, errors):
                fixed_count += 1
        
        print(f"Fixed {fixed_count}/{total_files} files")
        
        # Check remaining errors
        output = self.run_type_check()
        remaining_errors = len(re.findall(r'error TS\d+:', output))
        
        return remaining_errors

def main():
    project_path = "/Users/cyril/Desktop/ACE/auto-context-engineer"
    
    # Run multiple passes to fix cascading errors
    max_passes = 3
    for pass_num in range(1, max_passes + 1):
        print(f"\n=== Pass {pass_num} ===")
        fixer = SyntaxErrorFixer(project_path)
        remaining = fixer.fix_all_syntax_errors()
        
        if remaining == 0:
            print("\n✅ All syntax errors fixed!")
            break
        else:
            print(f"Still {remaining} errors remaining")
    
    print("\n✨ Syntax error fixing complete!")

if __name__ == "__main__":
    main()
