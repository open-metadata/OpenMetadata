# Custom ESLint Rules for OpenMetadata UI

This directory contains custom ESLint rules specifically designed for the OpenMetadata UI codebase.

## Available Rules

### `no-duplicate-api-calls`

**Type:** Problem
**Severity:** Warning (configurable)
**Category:** Best Practices

#### Description

Detects duplicate API calls within the same React component or file. This anti-pattern can cause:

- **Performance issues**: Unnecessary network requests slow down the application
- **Wasted bandwidth**: Multiple identical requests consume network resources
- **Race conditions**: Multiple concurrent requests to the same endpoint can lead to inconsistent state
- **Poor user experience**: Delayed responses and flickering UI
- **Increased server load**: Redundant requests put unnecessary load on backend services

#### Examples

❌ **Bad** - Duplicate API calls in the same component:

```typescript
export const BadComponent = () => {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  // First call
  useEffect(() => {
    searchQuery({
      query: '*',
      pageNumber: 1,
      pageSize: 10,
      searchIndex: 'user_search_index',
    }).then((res) => setUsers(res.data));
  }, []);

  // Duplicate call with same parameters!
  useEffect(() => {
    searchQuery({
      query: '*',
      pageNumber: 1,
      pageSize: 10,
      searchIndex: 'user_search_index',
    }).then((res) => setTeams(res.data));
  }, []);

  return <div>...</div>;
};
```

✅ **Good** - Single API call with shared state:

```typescript
export const GoodComponent = () => {
  const [data, setData] = useState([]);

  // Single call
  useEffect(() => {
    searchQuery({
      query: '*',
      pageNumber: 1,
      pageSize: 10,
      searchIndex: 'user_search_index',
    }).then((res) => setData(res.data));
  }, []);

  return <div>...</div>;
};
```

✅ **Better** - Custom hook for reusability:

```typescript
// Create a custom hook
const useSearchData = (index: string) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    searchQuery({
      query: '*',
      pageNumber: 1,
      pageSize: 10,
      searchIndex: index,
    })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [index]);

  return { data, loading };
};

// Use in component
export const BestComponent = () => {
  const { data: users } = useSearchData('user_search_index');
  const { data: tables } = useSearchData('table_search_index');

  return <div>...</div>;
};
```

#### Configuration

```javascript
{
  'custom-rules/no-duplicate-api-calls': [
    'warn',  // or 'error'
    {
      threshold: 2,                    // Minimum number of calls before reporting (default: 2)
      checkUseEffect: true,            // Check across useEffect hooks (default: true)
      checkCallbacks: true,            // Check in event handlers (default: true)
      allowedDuplicates: ['fetchConfig'] // Functions allowed to be called multiple times
    }
  ]
}
```

#### Options

- **`threshold`** (number, default: `2`): Number of duplicate calls before reporting. Set to `2` to report any duplicate.

- **`checkUseEffect`** (boolean, default: `true`): Whether to check for duplicates across multiple `useEffect` hooks in the same component.

- **`checkCallbacks`** (boolean, default: `true`): Whether to check for duplicates in event handlers and callbacks.

- **`allowedDuplicates`** (string[], default: `[]`): List of API function names that are allowed to be called multiple times. Use this for legitimate cases where the same API must be called multiple times with different purposes.

#### Detected API Call Patterns

The rule detects these common API call patterns:

- `searchQuery()` - OpenMetadata search API
- `fetch()` - Browser Fetch API
- `axios.*` - Axios HTTP client
- `APIClient.*` - Custom API client
- `get*ByName()` - Entity getter by name
- `get*ById()` - Entity getter by ID
- `get*ByFqn()` - Entity getter by FQN
- `fetch*()` - Fetch-prefixed functions
- `load*()` - Load-prefixed functions
- `create*()` - Create operations
- `update*()` - Update operations
- `delete*()` - Delete operations
- `patch*()` - Patch operations

#### Automatic Exclusions

The rule is automatically disabled for:

- **Test files**: `*.test.{js,jsx,ts,tsx}`, `*.spec.{js,jsx,ts,tsx}`
- **Test directories**: `__tests__/**`, `__mocks__/**`
- **Playwright tests**: `playwright/**/*.spec.{js,jsx,ts,tsx}`
- **Mock files**: Files in `eslint-rules/` for examples and testing

This is intentional because test files and mocks often need to make duplicate API calls to test different scenarios.

#### When to Suppress

You may want to suppress this rule in specific cases:

```typescript
// Different purposes - these are NOT duplicates
useEffect(() => {
  // Initial load
  searchQuery({ query: '*', pageNumber: 1 }).then(setData);
}, []);

useEffect(() => {
  // Refresh on specific trigger
  if (shouldRefresh) {
    searchQuery({ query: searchTerm, pageNumber: 1 }).then(setData);
  }
}, [shouldRefresh, searchTerm]);
```

```typescript
// Intentional duplicate with different handling
const handlePrimaryAction = () => {
  // eslint-disable-next-line custom-rules/no-duplicate-api-calls
  fetchData().then(handlePrimary);
};

const handleSecondaryAction = () => {
  // Different callback, legitimate use case
  // eslint-disable-next-line custom-rules/no-duplicate-api-calls
  fetchData().then(handleSecondary);
};
```

## Implementation Details

### How It Works

1. The rule traverses the AST (Abstract Syntax Tree) of your component
2. It tracks all function declarations and identifies React components (functions starting with uppercase)
3. For each component, it collects all API call expressions
4. It generates a signature for each call based on:
   - Function name (e.g., `searchQuery`)
   - First argument (if it's a string or object literal)
5. When the same signature appears multiple times, it reports a warning

### Limitations

- The rule uses static analysis and may not detect dynamically constructed API calls
- It focuses on literal arguments and may miss duplicates with computed values
- Cross-file duplicates are not detected (by design - different components may legitimately make the same calls)

## Development

### Testing the Rule

```bash
# Test on a specific file
yarn eslint path/to/component.tsx

# Test on all source files
yarn eslint src/

# Auto-fix (where possible)
yarn eslint src/ --fix
```

### Adding New API Patterns

To detect additional API call patterns, edit `eslint-rules/no-duplicate-api-calls.js` and add patterns to the `apiCallPatterns` array:

```javascript
const apiCallPatterns = [
  'searchQuery',
  'fetch',
  /myCustomApi[A-Z]\w+/,  // RegExp for pattern matching
  // Add your patterns here
];
```

## Contributing

When adding new custom rules:

1. Create a new file in `eslint-rules/` with the rule name
2. Export a rule object with `meta` and `create` properties
3. Add the rule to `eslint-rules/index.js`
4. Update `eslint.config.mjs` to enable the rule
5. Document the rule in this README

## References

- [ESLint Custom Rules Documentation](https://eslint.org/docs/latest/extend/custom-rules)
- [AST Explorer](https://astexplorer.net/) - Tool for exploring JavaScript AST
- [OpenMetadata Contribution Guidelines](../../../../../../../CONTRIBUTING.md)
