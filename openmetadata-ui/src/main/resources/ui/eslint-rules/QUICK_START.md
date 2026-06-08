# Quick Start: No Duplicate API Calls Rule

## TL;DR

✅ **Rule is active** - warns when the same API call appears 2+ times in a component
🧪 **Test files excluded** - rule automatically disabled for `*.test.tsx`, `*.spec.tsx`, `__tests__/`, `__mocks__/`
⚙️ **Configurable** - adjust threshold, add exceptions, change severity

## What Gets Detected

```typescript
// ❌ BAD - Will trigger warning
export const MyComponent = () => {
  useEffect(() => {
    searchQuery({ query: '*', pageSize: 10 }).then(setData1);
  }, []);

  useEffect(() => {
    searchQuery({ query: '*', pageSize: 10 }).then(setData2);  // Duplicate!
  }, []);

  return <div>...</div>;
};
```

## How to Fix

### Option 1: Single Call + Shared State

```typescript
// ✅ GOOD
export const MyComponent = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    searchQuery({ query: '*', pageSize: 10 }).then(setData);
  }, []);

  // Use data in multiple places
  return <div>...</div>;
};
```

### Option 2: Custom Hook

```typescript
// ✅ BETTER
const useSearchData = (query: string) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    searchQuery({ query, pageSize: 10 })
      .then(setData)
      .finally(() => setLoading(false));
  }, [query]);

  return { data, loading };
};

export const MyComponent = () => {
  const { data, loading } = useSearchData('*');
  return <div>...</div>;
};
```

### Option 3: React Query / SWR (Recommended)

```typescript
// ✅ BEST - Automatic caching & deduplication
export const MyComponent = () => {
  const { data, isLoading } = useQuery(
    ['search', '*'],
    () => searchQuery({ query: '*', pageSize: 10 })
  );

  return <div>...</div>;
};
```

## Quick Commands

```bash
# Check your code
yarn lint

# Check specific file
yarn lint path/to/file.tsx

# Auto-fix (where possible)
yarn lint --fix

# Check only this rule
yarn lint 2>&1 | grep "no-duplicate-api-calls"
```

## Suppressing When Needed

```typescript
// For one line
// eslint-disable-next-line custom-rules/no-duplicate-api-calls
searchQuery({ query: '*' }).then(handleSpecial);

// For entire file (add at top)
/* eslint-disable custom-rules/no-duplicate-api-calls */
```

## Need Help?

- **Full docs**: [README.md](./README.md)
- **Configuration**: [CONFIGURATION.md](./CONFIGURATION.md)
- **Examples**: [test-example.tsx](./test-example.tsx)

## Common Questions

**Q: Why is this a problem?**
A: Duplicate API calls waste network bandwidth, slow down your app, can cause race conditions, and create inconsistent state.

**Q: What if I need the same endpoint twice with different purposes?**
A: That's likely still a duplicate. Consider:
1. Fetching once and sharing the data
2. Using a caching library (React Query, SWR)
3. If truly different, add the function to `allowedDuplicates` in config

**Q: The rule isn't triggering on my test file**
A: Correct! Test files are intentionally excluded. Tests often need duplicate calls to test different scenarios.

**Q: Can I disable this for my component?**
A: Yes, but only if you have a good reason:
```typescript
// eslint-disable-next-line custom-rules/no-duplicate-api-calls
```
Consider if refactoring would be better.

**Q: How do I add an exception for a specific API function?**
A: Edit `eslint.config.mjs` and add to `allowedDuplicates`:
```javascript
'custom-rules/no-duplicate-api-calls': [
  'warn',
  {
    allowedDuplicates: ['mySpecialFunction'],
  },
]
```
