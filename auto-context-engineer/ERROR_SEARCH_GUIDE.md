# Error Search and Detection Tools

This document describes the enhanced error detection and search capabilities for the auto-context-engineer project.

## Overview

The project includes comprehensive error detection and search tools that help developers quickly identify, categorize, and fix issues in the codebase.

## Current Error Status

- **Total Errors**: 3,598 TypeScript compilation errors
- **Critical**: 7 (import/export issues)
- **High**: 1,100 (property access and type issues)
- **Auto-fixable**: 1,197 (can be fixed automatically)
- **Test Status**: 100% pass rate (all tests passing)

## Tools Available

### 1. Enhanced Error Detection (`enhancedErrorDetection.cjs`)

Comprehensive error detection with advanced categorization and search indexing.

**Usage:**
```bash
# Run full error detection
npm run errors:detect
# or
node scripts/enhancedErrorDetection.cjs

# Search for specific errors during detection
node scripts/enhancedErrorDetection.cjs search "property"
node scripts/enhancedErrorDetection.cjs search "import"
```

**Features:**
- Timeout protection to prevent hanging
- Advanced error categorization
- Search term extraction and indexing
- Prioritized action plans
- Comprehensive reporting with statistics

### 2. Quick Error Search (`quickErrorSearch.cjs`)

Fast search through existing error reports without re-running detection.

**Usage:**
```bash
# Search existing reports
npm run errors:search <search-term>
# or
node scripts/quickErrorSearch.cjs <search-term>

# Pre-configured searches
npm run errors:property    # Search for property-related errors
npm run errors:import      # Search for import/export errors  
npm run errors:type        # Search for type-related errors

# Pattern-based searches
node scripts/quickErrorSearch.cjs pattern property
node scripts/quickErrorSearch.cjs pattern import
node scripts/quickErrorSearch.cjs pattern type
```

**Available Patterns:**
- `property` - Property access errors (TS2551, TS2561)
- `import` - Import/export errors (TS2724)
- `type` - Type assignment errors (TS2345)
- `undefined` - Undefined value errors
- `any` - Any type safety errors
- `unused` - Unused variable errors (TS6133)
- `duplicate` - Duplicate identifier errors (TS2300)

## Error Categories Found

### Critical (7 errors) - Fix First
- **Import/Export Issues**: Mismatched import/export names
- Files affected: `src/background.ts`, `src/services/compatibility/`

### High Priority (1,100 errors) - Important
- **Property Access**: Underscore prefix mismatches (`_property` vs `property`)
- **Object Properties**: Object literal property name issues
- **Type Assignments**: Type safety violations

### Medium Priority (2,306 errors) - Moderate
- **Implicit Any**: Missing type annotations
- **Generic Types**: Type parameter issues

### Low Priority (185 errors) - Cleanup
- **Unused Variables**: Variables declared but never used
- **Code Style**: Formatting and linting issues

## Common Error Patterns

### 1. Property Name Mismatches (570 errors)
```typescript
// Error: Property '_status' does not exist
changeInfo._status === "complete"
// Fix: Use correct property name
changeInfo.status === "complete"
```

### 2. Import/Export Issues (7 errors)
```typescript
// Error: No exported member 'compatibilityIntegration'
import { compatibilityIntegration } from "./compatibilityIntegration";
// Fix: Use correct export name
import { CompatibilityIntegration } from "./compatibilityIntegration";
```

### 3. Object Property Issues (429 errors)
```typescript
// Error: 'status' does not exist in type 'HealthStatus'
return { status: "healthy" };
// Fix: Use correct property name
return { _status: "healthy" };
```

## Files with Most Errors

1. `src/services/cloud/providers/geminiService.ts` - 186 errors
2. `src/services/cloud/providers/claudeService.ts` - 175 errors  
3. `src/services/cloud/providers/multiProviderIntegration.ts` - 170 errors
4. `src/services/cloud/apiGateway.ts` - 161 errors
5. `src/services/cloud/providers/openaiService.ts` - 145 errors

## Quick Fix Commands

### Auto-fixable Issues (1,197 errors)
```bash
# Apply ESLint fixes
npx eslint src --ext .ts,.tsx --fix

# Format code
npx prettier --write "src/**/*.{ts,tsx}"
```

### Type Checking
```bash
# Check TypeScript compilation
npm run type-check

# Run tests
npm test
```

### Search for Specific Patterns
```bash
# Find all property access issues
grep -r "Property.*does not exist" src/

# Find TypeScript error codes
grep -r "TS2551\|TS2561" src/

# Find underscore property usage
grep -r "_[a-zA-Z]" src/ | grep -E "\.(ts|tsx):"
```

## Integration with Development Workflow

### Pre-commit Hooks
The project includes lint-staged configuration that automatically:
- Runs ESLint with auto-fix
- Formats code with Prettier
- Ensures code quality before commits

### CI/CD Integration
Error detection can be integrated into continuous integration:
```bash
# In CI pipeline
npm run errors:detect
npm run type-check
npm test
```

## Advanced Search Capabilities

### Search by File
Find all errors in specific files or directories:
```bash
node scripts/quickErrorSearch.cjs "src/background.ts"
node scripts/quickErrorSearch.cjs "src/services/cloud"
```

### Search by Error Code
Find specific TypeScript error codes:
```bash
node scripts/quickErrorSearch.cjs "TS2551"
node scripts/quickErrorSearch.cjs "TS2724"
```

### Search by Message Pattern
Find errors with specific message patterns:
```bash
node scripts/quickErrorSearch.cjs "does not exist"
node scripts/quickErrorSearch.cjs "implicitly has"
node scripts/quickErrorSearch.cjs "not assignable"
```

## Troubleshooting

### If Error Detection Hangs
The enhanced error detection includes timeout protection, but if issues persist:

1. Check if TypeScript compilation is stuck:
   ```bash
   npx tsc --noEmit --incremental false
   ```

2. Check if tests are hanging:
   ```bash
   npx vitest --run --reporter=basic
   ```

3. Run individual components:
   ```bash
   # TypeScript only
   npx tsc --noEmit
   
   # ESLint only
   npx eslint src --ext .ts,.tsx --format json
   ```

### Performance Optimization

For large codebases, you can:
- Use specific file patterns: `npx eslint src/specific-directory --ext .ts,.tsx`
- Skip test detection if not needed
- Use the quick search for subsequent searches without re-detection

## Contributing

When adding new error detection patterns:
1. Update the categorization in `enhancedErrorDetection.cjs`
2. Add new search patterns in `quickErrorSearch.cjs`  
3. Update this README with new patterns and examples
4. Test with existing error reports

## Next Steps

1. **Fix Critical Errors**: Start with the 7 import/export issues
2. **Apply Auto-fixes**: Use ESLint and Prettier to fix 1,197 errors automatically
3. **Address Property Issues**: Fix the 570 property access errors systematically
4. **Improve Type Safety**: Add proper type annotations for implicit any errors

The enhanced error detection system provides a solid foundation for maintaining code quality and quickly identifying issues across the large codebase.