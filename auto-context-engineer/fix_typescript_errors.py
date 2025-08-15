#!/usr/bin/env python3
"""
Script to fix TypeScript variable naming inconsistencies.
Fixes cases where variables are declared with underscores but referenced without them.
"""

import re
import os
import sys
from pathlib import Path

def fix_variable_references(content):
    """Fix variable references to match their declarations."""
    
    # Pattern to find variable declarations with underscores
    # Matches: let _variableName, const _variableName, var _variableName
    declaration_pattern = r'\b(let|const|var)\s+(_\w+)(?:\s*[:=])'
    
    # Find all declared variables with underscores
    declared_vars = set()
    for match in re.finditer(declaration_pattern, content):
        declared_vars.add(match.group(2))
    
    # Create a mapping of non-underscore to underscore versions
    var_mapping = {}
    for var in declared_vars:
        if var.startswith('_'):
            non_underscore = var[1:]  # Remove the underscore
            var_mapping[non_underscore] = var
    
    # Fix references to these variables
    fixed_content = content
    for non_underscore, underscore in var_mapping.items():
        # Pattern to match variable usage (not declaration)
        # Avoid matching properties, types, or already correct references
        patterns = [
            # Variable usage (not property access)
            (rf'\b{non_underscore}\b(?![:\.])', underscore),
            # After await, user., etc.
            (rf'(await\s+|user\.|fireEvent\.)\b{non_underscore}\b', rf'\1{underscore}'),
            # In function calls
            (rf'([(,]\s*)\b{non_underscore}\b', rf'\1{underscore}'),
            # In array access
            (rf'\[{non_underscore}\]', f'[{underscore}]'),
            # In conditionals
            (rf'(if\s*\(|while\s*\(|for\s*\(.*)\b{non_underscore}\b', rf'\1{underscore}'),
            # In expect statements
            (rf'expect\(\s*{non_underscore}\s*\)', f'expect({underscore})'),
        ]
        
        for pattern, replacement in patterns:
            # Check if this would create a double underscore
            if f'_{underscore}' not in fixed_content:
                fixed_content = re.sub(pattern, replacement, fixed_content)
    
    return fixed_content

def fix_property_names(content):
    """Fix property name inconsistencies (e.g., _type vs type)."""
    
    # Fix BackgroundEvent type property references
    content = re.sub(r'\bevent\.type\b', 'event._type', content)
    content = re.sub(r"'type':\s*BackgroundEventType", "'_type': BackgroundEventType", content)
    content = re.sub(r'\btype:\s*BackgroundEventType', '_type: BackgroundEventType', content)
    
    # Fix other common property mismatches
    property_fixes = [
        (r"{ type: '", "{ _type: '"),
        (r'\.type\s*===\s*', '._type === '),
        (r'\.type\s*!==\s*', '._type !== '),
    ]
    
    for pattern, replacement in property_fixes:
        content = re.sub(pattern, replacement, content)
    
    return content

def fix_test_file_specific_issues(content, filepath):
    """Fix test-file specific issues."""
    
    if '.test.' in filepath or '.spec.' in filepath:
        # Fix mock variable references
        mock_patterns = [
            (r'\bmockOnSearch\b', '_mockOnSearch'),
            (r'\bmockOnResultSelect\b', '_mockOnResultSelect'),
            (r'\bmockPreferences\b', '_mockPreferences'),
            (r'\bmockOnUpdatePreferences\b', '_mockOnUpdatePreferences'),
            (r'\bmockOnSave\b', '_mockOnSave'),
            (r'\bmockSettingsService\b', '_mockSettingsService'),
            (r'\bmockStorageService\b', '_mockStorageService'),
            (r'\bmockApiGateway\b', '_mockApiGateway'),
            (r'\bmockApiKeyManager\b', '_mockApiKeyManager'),
            (r'\bmockCostEstimator\b', '_mockCostEstimator'),
            (r'\bmockEventBus\b', '_mockEventBus'),
            (r'\bclaudeService\b', '_claudeService'),
            (r'\bgeminiService\b', '_geminiService'),
            (r'\bopenaiService\b', '_openaiService'),
        ]
        
        for pattern, replacement in mock_patterns:
            # Don't replace if it's already correct
            if replacement not in content or content.count(pattern) > content.count(replacement):
                content = re.sub(pattern, replacement, content)
        
        # Fix common test variable patterns
        test_patterns = [
            (r'\buser\b(?!Event|Agent)', '_user'),
            (r'\bmodels\b(?!\.)', '_models'),
            (r'\bmodel\b(?!s|\.)', '_model'),
            (r'\bresult\b(?!s|\.)', '_result'),
            (r'\bcontent\b(?!s|Type|\.)', '_content'),
            (r'\boptions\b(?!\.)', '_options'),
            (r'\bcomparison\b', '_comparison'),
        ]
        
        for pattern, replacement in test_patterns:
            # Only replace if the underscore version is declared
            if f'const {replacement}' in content or f'let {replacement}' in content:
                content = re.sub(pattern, replacement, content)
    
    return content

def fix_import_issues(content):
    """Fix import statement issues."""
    
    # Ensure imports are correct
    import_fixes = [
        (r"from '\.\./types'", "from '../types'"),
        (r"from '\.\./\.\./types'", "from '../../types'"),
    ]
    
    for pattern, replacement in import_fixes:
        content = re.sub(pattern, replacement, content)
    
    return content

def process_file(filepath):
    """Process a single TypeScript file."""
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Apply fixes in order
        content = fix_variable_references(content)
        content = fix_property_names(content)
        content = fix_test_file_specific_issues(content, str(filepath))
        content = fix_import_issues(content)
        
        # Only write if changes were made
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

def main():
    """Main function to process all TypeScript files."""
    
    # Find all TypeScript files
    root_dir = Path('/Users/cyril/Desktop/ACE/auto-context-engineer')
    ts_files = list(root_dir.glob('src/**/*.ts'))
    tsx_files = list(root_dir.glob('src/**/*.tsx'))
    all_files = ts_files + tsx_files
    
    print(f"Found {len(all_files)} TypeScript files to process")
    
    modified_count = 0
    for filepath in all_files:
        if 'node_modules' not in str(filepath):
            if process_file(filepath):
                modified_count += 1
                print(f"Fixed: {filepath.relative_to(root_dir)}")
    
    print(f"\nModified {modified_count} files")

if __name__ == "__main__":
    main()
