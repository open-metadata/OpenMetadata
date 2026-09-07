---
description: How UI code reads permissions — the useEntityPermissions hook, derived flags, and the ban on raw permission-key reads
paths: "openmetadata-ui/src/main/resources/ui/**/*.{ts,tsx}"
---

# Frontend permissions

Applies to UI `*.{ts,tsx}`. Conceptual background and the full flag table:
`openmetadata-ui/src/main/resources/ui/docs/permissions.md`.

**One rule: never read a permission key directly. Ask for the intent.**

```ts
// ✗ banned — `openmetadata-permissions/no-raw-permission-access` fails the build
if (permissions.EditAll || permissions.EditDescription) { … }

// ✓ derived flag
const { canEditDescription } = useEntityPermissions(ResourceEntity.TABLE, fqn);
```

The rule guards `EditAll`, `ViewAll` and `ViewBasic` at **error** level. Other keys are not yet
guarded, but the same rule applies — use the flag.

## Fetching an entity's permissions

```ts
const {
  canEditTags, canEditDescription, hasViewAccess, // …derived flags
  permissions,      // raw OperationPermission, for props that still require it
  isLoading, error, refresh,
} = useEntityPermissions(resource, identifier, options);
```

- `resource` — a `ResourceEntity`.
- `identifier` — an **fqn string**, or `{ id }` to look up by id.
- `options` — `{ deleted?: boolean; enabled?: boolean }`.

`enabled: false` skips the fetch; use it when the fqn/id isn't known yet. Results are cached in
React Query under `permissionQueryKeys`, so several components asking for the same entity share
one request. `PermissionProvider` reads the same cache — mixing old and new code does not
double-fetch.

**Always pass `deleted` when the entity can be soft-deleted.** Every `canEdit*` flag is gated on
it (a soft-deleted entity is read-only). View and delete flags are deliberately *not* gated —
delete surfaces restore/purge.

> **Restore affordances must use an ungated derivation.** Gating the manage button on a
> `deleted`-aware flag removes the only path to restore a soft-deleted entity. Derive a second,
> ungated set for those controls (`DataAssetsHeader`'s `ungatedFlags` is the precedent).

## No named flag for the operation?

Use the escape hatch — it routes through the same prioritization and `deleted` gating:

```ts
const flags = getDerivedPermissionFlags(permissions, deleted);
flags.can(Operation.EditStatus);
```

## Deriving from permissions you already hold

For a prop-supplied `OperationPermission`, or a per-row bulk lookup, call the pure function
directly instead of fetching:

```ts
const flags = getDerivedPermissionFlags(permission ?? DEFAULT_ENTITY_PERMISSION, deleted);
```

For a list of entities, `useBulkEntityPermissions(resource, fqns)` returns `flagsByFqn` and shares
the single-entity cache.

## Prioritization — explicit deny beats a broader grant

`canEditTags` is **not** `EditTags || EditAll`. When the payload carries the field key, that key
wins even if it is `false`; `EditAll` is only the fallback when the key is absent. Do not
"restore" the old OR — an explicit `EditTags: false` alongside `EditAll: true` must deny.

## Testing

Mock the **hook**, and run the **real** derivation over a minimal permission object, so the
assertions stay meaningful:

```ts
const mockUseEntityPermissions = jest.fn();
jest.mock('…/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...a: unknown[]) => mockUseEntityPermissions(...a),
}));

mockUseEntityPermissions.mockReturnValue({
  permissions, isLoading: false, error: null, refresh: jest.fn(),
  ...getDerivedPermissionFlags(permissions, false),
});
```

Any component reaching `useEntityPermissions` / `useBulkEntityPermissions` needs a
`QueryClientProvider` in the test tree — use `renderWithQueryClient` from
`src/test/unit/test-utils.tsx`, or compose a wrapper when the test also needs a router. Without
it React Query throws *"No QueryClient set"*.

## Changing behaviour

Behavioural decisions live in `src/utils/permissionPolicy.ts`. Change them there — a documented
one-line edit with a stated blast radius — rather than at call sites.
