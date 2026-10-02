---
description: How UI code reads permissions — the useEntityPermissions hook, derived flags, and the ban on raw permission-key reads
paths: "openmetadata-ui/src/main/resources/ui/**/*.{ts,tsx}"
---

# Frontend permissions

Applies to UI `*.{ts,tsx}`. Concept, full flag table and rationale:
`openmetadata-ui/src/main/resources/ui/docs/permissions.md`.

**One rule: never read a permission key directly. Ask for the intent.**

```ts
// ✗ banned — `openmetadata-permissions/no-raw-permission-access` fails the build
if (permissions.EditAll || permissions.EditDescription) { … }

// ✓ derived flag
const { canEditDescription } = useEntityPermissions(ResourceEntity.TABLE, fqn);
```

The rule guards `EditAll`, `ViewAll` and `ViewBasic` at **error**. Other keys are unguarded but
the same rule applies — use the flag.

## Fetching

```ts
const {
  canEditTags, hasViewAccess, /* …flags */
  permissions,      // raw OperationPermission, for props that still require it
  isLoading, error, refresh,
} = useEntityPermissions(resource, identifier, options);
```

- `identifier` — an **fqn string**, or `{ id }` to look up by id.
- `options` — `{ deleted?: boolean; enabled?: boolean }`; `enabled: false` skips the fetch when
  the fqn/id isn't known yet.

Results are cached in React Query under `permissionQueryKeys`, so components asking for the same
entity share one request. `PermissionProvider` reads the same cache — mixing old and new code
does not double-fetch.

**Always pass `deleted` when the entity can be soft-deleted.** Every `canEdit*` is gated on it;
view and delete flags deliberately are not, since delete surfaces restore/purge.

> **Restore affordances need an ungated derivation.** Gating a manage button on a
> `deleted`-aware flag removes the only path to restore a soft-deleted entity — derive a second,
> ungated set for those controls (`DataAssetsHeader`'s `ungatedFlags` is the precedent).

## No named flag for the operation?

```ts
getDerivedPermissionFlags(permissions, deleted).can(Operation.EditStatus);
```

Same prioritization and `deleted` gating as the named flags.

## Already holding permissions

For a prop-supplied `OperationPermission` or a per-row bulk lookup, call the pure function
instead of fetching:

```ts
const flags = getDerivedPermissionFlags(permission ?? DEFAULT_ENTITY_PERMISSION, deleted);
```

For lists, `useBulkEntityPermissions(resource, fqns)` returns `flagsByFqn` and shares the
single-entity cache.

## Prioritization — explicit deny beats a broader grant

`canEditTags` is **not** `EditTags || EditAll`. When the payload carries the field key that key
wins, including when it is `false`; `EditAll` is only the fallback when the key is absent. Do not
"restore" the old OR — an explicit `EditTags: false` alongside `EditAll: true` must deny.

## Testing

Mock the **hook**, run the **real** derivation over a minimal permission object:

```ts
mockUseEntityPermissions.mockReturnValue({
  permissions, isLoading: false, error: null, refresh: jest.fn(),
  ...getDerivedPermissionFlags(permissions, false),
});
```

Components reaching these hooks need a `QueryClientProvider` — use `renderWithQueryClient`
(`src/test/unit/test-utils.tsx`), or compose a wrapper when the test also needs a router.
Without it React Query throws *"No QueryClient set"* and the whole suite fails to run.

## Changing behaviour

Behavioural decisions live in `src/utils/permissionPolicy.ts` — change them there, once, rather
than at call sites.
