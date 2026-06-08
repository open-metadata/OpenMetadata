# ESLint Custom Rules Configuration

## Current Configuration

### `no-duplicate-api-calls`

**Status**: ✅ Enabled (as warning)
**Severity**: `warn`
**Location**: [`eslint.config.mjs`](../eslint.config.mjs)

```javascript
'custom-rules/no-duplicate-api-calls': [
  'warn',
  {
    threshold: 2,
    checkUseEffect: true,
    checkCallbacks: true,
    allowedDuplicates: [],
  },
]
```

#### Active Configuration

| Option | Value | Description |
|--------|-------|-------------|
| `threshold` | `2` | Reports when 2+ identical API calls are detected |
| `checkUseEffect` | `true` | Checks for duplicates across multiple `useEffect` hooks |
| `checkCallbacks` | `true` | Checks for duplicates in event handlers and callbacks |
| `allowedDuplicates` | `[]` | No exceptions - all duplicates are reported |

#### File Exclusions

The rule is **automatically disabled** for:

```javascript
// From eslint.config.mjs - Test setup files section
{
  files: [
    'src/setupTests.js',
    'src/**/*.test.{js,jsx,ts,tsx}',      // Jest/Vitest tests
    'src/**/*.spec.{js,jsx,ts,tsx}',      // Spec files
    'playwright/**/*.spec.{js,jsx,ts,tsx}', // E2E tests
    '**/*.test.{js,jsx,ts,tsx}',          // All test files
    '**/*.spec.{js,jsx,ts,tsx}',          // All spec files
    '**/__tests__/**',                     // Test directories
    '**/__mocks__/**',                     // Mock directories
    'eslint-rules/**/*.tsx',               // Example files
  ],
  rules: {
    'custom-rules/no-duplicate-api-calls': 'off',
  },
}
```

**Why these exclusions?**
- Test files and mocks legitimately need duplicate API calls to test different scenarios
- Example files are for documentation purposes
- Mocking patterns often require multiple similar calls with different responses

## Adjusting the Configuration

### Change Severity

To make violations block builds (error instead of warning):

```javascript
'custom-rules/no-duplicate-api-calls': [
  'error',  // Changed from 'warn'
  { /* options */ }
]
```

To disable completely:

```javascript
'custom-rules/no-duplicate-api-calls': 'off'
```

### Allow Specific Functions

If a function legitimately needs to be called multiple times:

```javascript
'custom-rules/no-duplicate-api-calls': [
  'warn',
  {
    threshold: 2,
    checkUseEffect: true,
    checkCallbacks: true,
    allowedDuplicates: [
      'fetchConfigData',     // Config might be fetched multiple times
      'logAnalyticsEvent',   // Analytics can fire multiple times
      'validateToken',       // Token validation might be needed in parallel
    ],
  },
]
```

### Increase Threshold

To only report when 3+ duplicates are detected:

```javascript
'custom-rules/no-duplicate-api-calls': [
  'warn',
  {
    threshold: 3,  // Changed from 2
    // ... other options
  },
]
```

### Disable Specific Checks

To disable checking in event handlers but keep useEffect checking:

```javascript
'custom-rules/no-duplicate-api-calls': [
  'warn',
  {
    threshold: 2,
    checkUseEffect: true,
    checkCallbacks: false,  // Disabled
    allowedDuplicates: [],
  },
]
```

## Per-File Overrides

To disable for specific files or directories:

```javascript
// Add to eslint.config.mjs
{
  files: ['src/legacy/**/*.tsx'],  // Legacy code
  rules: {
    'custom-rules/no-duplicate-api-calls': 'off',
  },
}
```

## Inline Suppressions

In rare cases, suppress in the code itself:

```typescript
// Disable for next line
// eslint-disable-next-line custom-rules/no-duplicate-api-calls
searchQuery({ query: '*' }).then(handleSpecialCase);

// Disable for entire file (at top of file)
/* eslint-disable custom-rules/no-duplicate-api-calls */

// Disable for a block
/* eslint-disable custom-rules/no-duplicate-api-calls */
const handleMultipleCalls = () => {
  searchQuery({ query: '*' }).then(handler1);
  searchQuery({ query: '*' }).then(handler2);
};
/* eslint-enable custom-rules/no-duplicate-api-calls */
```

## Monitoring and Reports

### Check Current Violations

```bash
# Check entire codebase
yarn lint

# Check specific directory
yarn lint src/components/

# Check with auto-fix (where possible)
yarn lint --fix

# Get detailed report
yarn lint --format json > lint-report.json
```

### Filter for This Rule Only

```bash
# Show only duplicate API call warnings
yarn lint 2>&1 | grep "no-duplicate-api-calls"

# Count violations
yarn lint 2>&1 | grep -c "no-duplicate-api-calls"
```

## Best Practices

### 1. Run Before Committing

Add to your git hooks or CI/CD pipeline:

```json
// package.json
{
  "scripts": {
    "precommit": "yarn lint",
    "ci:lint": "yarn lint --max-warnings 0"
  }
}
```

### 2. Gradual Adoption

If you have many existing violations:

1. Start with `'warn'` to identify issues
2. Fix violations incrementally
3. Switch to `'error'` when codebase is clean
4. Increase `threshold` temporarily if needed

### 3. Team Communication

- Document your `allowedDuplicates` with comments explaining why
- Share patterns for custom hooks to avoid duplicates
- Review violations in code review

## Migration Guide

### From Existing Codebase

If enabling this rule on existing code with violations:

```javascript
// Step 1: Start with warnings and high threshold
'custom-rules/no-duplicate-api-calls': [
  'warn',
  { threshold: 5 },  // Only report obvious problems
]

// Step 2: Lower threshold as you fix issues
'custom-rules/no-duplicate-api-calls': [
  'warn',
  { threshold: 3 },
]

// Step 3: Final configuration
'custom-rules/no-duplicate-api-calls': [
  'error',
  { threshold: 2 },
]
```

### Common Refactoring Patterns

When fixing violations, use these patterns:

**Pattern 1: Custom Hook**
```typescript
// Before: Duplicate calls
const Component1 = () => {
  useEffect(() => { fetchUsers().then(setData); }, []);
};
const Component2 = () => {
  useEffect(() => { fetchUsers().then(setData); }, []);
};

// After: Shared hook
const useUsers = () => {
  const [data, setData] = useState([]);
  useEffect(() => { fetchUsers().then(setData); }, []);
  return data;
};
```

**Pattern 2: Context Provider**
```typescript
// Create provider for shared data
const DataContext = createContext();
const DataProvider = ({ children }) => {
  const [data, setData] = useState([]);
  useEffect(() => { fetchData().then(setData); }, []);
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
};
```

**Pattern 3: React Query / SWR**
```typescript
// Before: Manual fetching
useEffect(() => { fetchData().then(setData); }, []);

// After: With caching library
const { data } = useQuery('dataKey', fetchData);
```

## Troubleshooting

### Rule Not Triggering

1. Check the file is not excluded (see [File Exclusions](#file-exclusions))
2. Verify the API call matches detected patterns
3. Ensure rule is enabled in `eslint.config.mjs`

### False Positives

1. Add function to `allowedDuplicates`
2. Use inline suppression with comment explaining why
3. Report issue if pattern should be excluded globally

### Performance Issues

If linting is slow:

1. Ensure you're not linting `node_modules/`
2. Check ignore patterns in `eslint.config.mjs`
3. Consider increasing `threshold` to reduce checks

## Support

- **Documentation**: [README.md](./README.md)
- **Examples**: [test-example.tsx](./test-example.tsx)
- **Rule Source**: [no-duplicate-api-calls.js](./no-duplicate-api-calls.js)
