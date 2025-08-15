#!/usr/bin/env python3
"""
Enhanced script to fix remaining TypeScript errors.
Focuses on property mismatches, interface compliance, and remaining variable issues.
"""

import re
import os
from pathlib import Path

def fix_property_mismatches(content):
    """Fix property name mismatches in objects and interfaces."""
    
    # Common property underscore fixes
    property_patterns = [
        # Fix properties that should have underscores
        (r"(\{[^}]*?)\btype:\s*BackgroundEventType", r"\1_type: BackgroundEventType"),
        (r"(\{[^}]*?)\bname:\s*/", r"\1_name: /"),
        (r"(\{[^}]*?)\blevel:\s*\d", r"\1_level: \1"),
        (r"(\{[^}]*?)\bmodel:\s*'", r"\1_model: '"),
        (r"(\{[^}]*?)\bpayload:\s*\{", r"\1_payload: {"),
        (r"(\{[^}]*?)\btemperature:\s*", r"\1_temperature: "),
        (r"(\{[^}]*?)\bmaxTokens:\s*", r"\1_maxTokens: "),
        (r"(\{[^}]*?)\btopP:\s*", r"\1_topP: "),
        (r"(\{[^}]*?)\btopK:\s*", r"\1_topK: "),
        (r"(\{[^}]*?)\bsystemPrompt:\s*", r"\1_systemPrompt: "),
        (r"(\{[^}]*?)\bisSaving:\s*", r"\1_isSaving: "),
        (r"(\{[^}]*?)\btarget:\s*\{", r"\1_target: {"),
        (r"(\{[^}]*?)\bsuccess:\s*", r"\1_success: "),
        (r"(\{[^}]*?)\berror:\s*", r"\1_error: "),
        (r"(\{[^}]*?)\blatency:\s*", r"\1_latency: "),
        (r"(\{[^}]*?)\bprovider:\s*CloudProvider", r"\1_provider: CloudProvider"),
        (r"(\{[^}]*?)\busage:\s*\{", r"\1_usage: {"),
        (r"(\{[^}]*?)\bcost:\s*", r"\1_cost: "),
        (r"(\{[^}]*?)\boutputTokens:\s*", r"\1_outputTokens: "),
        (r"(\{[^}]*?)\btotalTokens:\s*", r"\1_totalTokens: "),
        (r"(\{[^}]*?)\binputTokens:\s*", r"\1_inputTokens: "),
        (r"(\{[^}]*?)\binputCost:\s*", r"\1_inputCost: "),
        (r"(\{[^}]*?)\boutputCost:\s*", r"\1_outputCost: "),
        (r"(\{[^}]*?)\btotalCost:\s*", r"\1_totalCost: "),
        (r"(\{[^}]*?)\bcurrency:\s*", r"\1_currency: "),
        (r"(\{[^}]*?)\bestimatedAt:\s*", r"\1_estimatedAt: "),
        (r"(\{[^}]*?)\bwritable:\s*", r"\1_writable: "),
        (r"(\{[^}]*?)\bauditLogging:\s*", r"\1_auditLogging: "),
    ]
    
    for pattern, replacement in property_patterns:
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    
    # Fix specific event type issues
    content = re.sub(r"type:\s*'([A-Z_]+)'", r"_type: '\1'", content)
    content = re.sub(r'type:\s*BackgroundEventType\.', '_type: BackgroundEventType.', content)
    
    return content

def fix_more_variable_references(content):
    """Fix additional variable reference issues that were missed."""
    
    # Find all underscore-prefixed variables and their non-underscore counterparts
    lines = content.split('\n')
    fixed_lines = []
    
    # Track declared variables in scope
    declared_vars = set()
    
    for line in lines:
        # Check for variable declarations
        decl_match = re.search(r'\b(const|let|var)\s+(_\w+)', line)
        if decl_match:
            declared_vars.add(decl_match.group(2))
        
        # Fix references based on declarations
        fixed_line = line
        for var in declared_vars:
            if var.startswith('_'):
                non_underscore = var[1:]
                # Fix various usage patterns
                patterns = [
                    (f'\\b{non_underscore}\\b(?!\\.)', var),
                    (f'expect\\({non_underscore}\\)', f'expect({var})'),
                    (f'await {non_underscore}\\b', f'await {var}'),
                    (f'\\({non_underscore}\\)', f'({var})'),
                    (f'\\[{non_underscore}\\]', f'[{var}]'),
                    (f'!{non_underscore}\\b', f'!{var}'),
                    (f'\\?{non_underscore}\\b', f'?{var}'),
                ]
                
                for pattern, replacement in patterns:
                    fixed_line = re.sub(pattern, replacement, fixed_line)
        
        fixed_lines.append(fixed_line)
    
    return '\n'.join(fixed_lines)

def fix_test_specific_patterns(content):
    """Fix test-specific patterns that are common sources of errors."""
    
    if '.test.' in content or '.spec.' in content:
        # Fix common test patterns
        test_fixes = [
            # Fix render functions
            (r'\brenderAdvancedSettings\b', '_renderAdvancedSettings'),
            (r'\brenderAdvancedSearch\b', '_renderAdvancedSearch'),
            
            # Fix common test elements
            (r'\b(?<![_])searchInput\b', '_searchInput'),
            (r'\b(?<![_])searchButton\b', '_searchButton'),
            (r'\b(?<![_])checkbox\b', '_checkbox'),
            (r'\b(?<![_])slider\b', '_slider'),
            (r'\b(?<![_])select\b', '_select'),
            (r'\b(?<![_])input\b', '_input'),
            (r'\b(?<![_])button\b', '_button'),
            (r'\b(?<![_])tabs\b', '_tabs'),
            (r'\b(?<![_])form\b', '_form'),
            
            # Fix specific component references
            (r'\b(?<![_])securityTab\b', '_securityTab'),
            (r'\b(?<![_])algorithmsTab\b', '_algorithmsTab'),
            (r'\b(?<![_])experimentalTab\b', '_experimentalTab'),
            (r'\b(?<![_])diagnosticsTab\b', '_diagnosticsTab'),
            (r'\b(?<![_])importExportTab\b', '_importExportTab'),
            (r'\b(?<![_])performanceTab\b', '_performanceTab'),
            
            # Fix other common test variables
            (r'\b(?<![_])warningBox\b', '_warningBox'),
            (r'\b(?<![_])infoBox\b', '_infoBox'),
            (r'\b(?<![_])errorHandlers\b', '_errorHandlers'),
            (r'\b(?<![_])backdrop\b', '_backdrop'),
            (r'\b(?<![_])filterToggle\b', '_filterToggle'),
            (r'\b(?<![_])firstResult\b', '_firstResult'),
            (r'\b(?<![_])closeButton\b', '_closeButton'),
            (r'\b(?<![_])clearButton\b', '_clearButton'),
            (r'\b(?<![_])saveButton\b', '_saveButton'),
            (r'\b(?<![_])settingsContent\b', '_settingsContent'),
            (r'\b(?<![_])settingGroups\b', '_settingGroups'),
            (r'\b(?<![_])focusedElement\b', '_focusedElement'),
            (r'\b(?<![_])encryptionContent\b', '_encryptionContent'),
            (r'\b(?<![_])highlightedTerms\b', '_highlightedTerms'),
            (r'\b(?<![_])numberInputs\b', '_numberInputs'),
            (r'\b(?<![_])checkboxes\b', '_checkboxes'),
            (r'\b(?<![_])inputs\b', '_inputs'),
            (r'\b(?<![_])selects\b', '_selects'),
            (r'\b(?<![_])label\b', '_label'),
            (r'\b(?<![_])ariaLabel\b', '_ariaLabel'),
            (r'\b(?<![_])description\b', '_description'),
            (r'\b(?<![_])firstInput\b', '_firstInput'),
            (r'\b(?<![_])warningContainer\b', '_warningContainer'),
            (r'\b(?<![_])performanceIcon\b', '_performanceIcon'),
        ]
        
        for pattern, replacement in test_fixes:
            # Only replace if the underscore version exists in declarations
            if f'const {replacement}' in content or f'let {replacement}' in content:
                content = re.sub(pattern, replacement, content)
    
    return content

def fix_specific_variable_patterns(content):
    """Fix specific variable patterns that are causing issues."""
    
    # Fix service-specific patterns
    service_patterns = [
        (r'\b(?<![_])haiku\b(?!Call)', '_haiku'),
        (r'\b(?<![_])opus\b(?!Call)', '_opus'),
        (r'\b(?<![_])sonnet\b(?!Call)', '_sonnet'),
        (r'\b(?<![_])shortContentModel\b', '_shortContentModel'),
        (r'\b(?<![_])longContentModel\b', '_longContentModel'),
        (r'\b(?<![_])budgetModel\b', '_budgetModel'),
        (r'\b(?<![_])modelInfo\b', '_modelInfo'),
        (r'\b(?<![_])veryLongContent\b', '_veryLongContent'),
        (r'\b(?<![_])shortContent\b', '_shortContent'),
        (r'\b(?<![_])longContent\b', '_longContent'),
        (r'\b(?<![_])localSummary\b', '_localSummary'),
        (r'\b(?<![_])opusCall\b', '_opusCall'),
        (r'\b(?<![_])haikuCall\b', '_haikuCall'),
        (r'\b(?<![_])shortCall\b', '_shortCall'),
        (r'\b(?<![_])longCall\b', '_longCall'),
        (r'\b(?<![_])mockRequest\b', '_mockRequest'),
        (r'\b(?<![_])longContentModel\b', '_longContentModel'),
        (r'\b(?<![_])ideCheckbox\b', '_ideCheckbox'),
        (r'\b(?<![_])qualitySlider\b', '_qualitySlider'),
        (r'\b(?<![_])sortSelect\b', '_sortSelect'),
        (r'\b(?<![_])emptySearch\b', '_emptySearch'),
        (r'\b(?<![_])slowSearch\b', '_slowSearch'),
        (r'\b(?<![_])resolveSearch\b', '_resolveSearch'),
        (r'\b(?<![_])errorSearch\b', '_errorSearch'),
        (r'\b(?<![_])numberInput\b', '_numberInput'),
        (r'\b(?<![_])mockSearchResults\b', '_mockSearchResults'),
    ]
    
    for pattern, replacement in service_patterns:
        # Check if this variable is likely declared
        if replacement[1:] in content:  # Check if non-underscore version exists
            content = re.sub(pattern, replacement, content)
    
    return content

def fix_implicit_any_parameters(content):
    """Fix parameters that implicitly have 'any' type."""
    
    # Common parameter type fixes
    param_fixes = [
        (r'forEach\((\w+) =>', r'forEach((\1: any) =>'),
        (r'map\((\w+) =>', r'map((\1: any) =>'),
        (r'filter\((\w+) =>', r'filter((\1: any) =>'),
        (r'some\((\w+) =>', r'some((\1: any) =>'),
        (r'every\((\w+) =>', r'every((\1: any) =>'),
        (r'find\((\w+) =>', r'find((\1: any) =>'),
    ]
    
    for pattern, replacement in param_fixes:
        # Only fix if not already typed
        if ': any' not in content:
            content = re.sub(pattern, replacement, content)
    
    return content

def process_file(filepath):
    """Process a single TypeScript file with enhanced fixes."""
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Apply all fixes
        content = fix_property_mismatches(content)
        content = fix_more_variable_references(content)
        content = fix_test_specific_patterns(content)
        content = fix_specific_variable_patterns(content)
        # Only fix implicit any for test files to avoid breaking production code
        if '.test.' in str(filepath) or '.spec.' in str(filepath):
            content = fix_implicit_any_parameters(content)
        
        # Write back if changed
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
    
    root_dir = Path('/Users/cyril/Desktop/ACE/auto-context-engineer')
    ts_files = list(root_dir.glob('src/**/*.ts'))
    tsx_files = list(root_dir.glob('src/**/*.tsx'))
    all_files = ts_files + tsx_files
    
    print(f"Processing {len(all_files)} TypeScript files for remaining errors...")
    
    modified_count = 0
    for filepath in all_files:
        if 'node_modules' not in str(filepath):
            if process_file(filepath):
                modified_count += 1
                print(f"Fixed: {filepath.relative_to(root_dir)}")
    
    print(f"\nModified {modified_count} files")

if __name__ == "__main__":
    main()
