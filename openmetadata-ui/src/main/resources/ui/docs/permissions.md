# Permissions — one door, named intents

> **Components ask what the user may *do*; they never compute it from permission keys.**

Everything below explains that sentence.

## The shape, and why

The backend authorizes through a single door: `authorizer.authorize(who, operation, resource)`,
backed by one `PolicyEvaluator` and one `SubjectCache`. The UI now mirrors it:

| Backend | Frontend |
|---|---|
| `authorizer.authorize(…)` | `useEntityPermissions(resource, identifier)` |
| `PolicyEvaluator` | `getDerivedPermissionFlags()` |
| `SubjectCache` | React Query cache under `['permissions', …]` |
| Framework 403 | ESLint `no-raw-permission-access` |

Before this, permission *derivation* — the logic deciding whether a user may edit tags, a
description, an owner — was copy-pasted across ~127 files. A rule change meant finding every
call site; missing three meant three screens with wrong permissions. Now the policy lives in one
module and components read intent.

## Using it

```ts
const {
  canEditTags, canEditDescription, hasViewAccess,  // named intents
  permissions,                                     // raw, for props that still need it
  isLoading, error, refresh,
} = useEntityPermissions(ResourceEntity.TABLE, fqn, { deleted: table.deleted });
```

`identifier` is an fqn string, or `{ id }` to fetch by id. `options` accepts `deleted` and
`enabled`.

Requests are cached and shared: two components asking for the same entity produce one call, and
`PermissionProvider` reads the same cache, so unconverted code doesn't double-fetch.

### The flags

`hasViewAccess` · `canEditAll` · `canEditTags` · `canEditGlossaryTerms` · `canEditDescription` ·
`canEditDisplayName` · `canEditCustomFields` · `canEditOwners` · `canEditTier` · `canEditLineage` ·
`canEditStatus` · `canEditSampleData` · `canCreate` · `canDelete` · `canViewAll` · `canViewBasic` ·
`canViewSampleData` · `canViewQueries` · `canViewDataProfile` · `canViewTests` · `canViewUsage` ·
`canViewCustomFields`

No flag for your operation? `flags.can(Operation.EditStatus)` routes through the same rules.

Already holding an `OperationPermission` (a prop, or a per-row bulk lookup)? Skip the fetch and
call the pure function: `getDerivedPermissionFlags(permission, deleted)`. For lists,
`useBulkEntityPermissions(resource, fqns)` returns `flagsByFqn`.

## Three rules worth knowing

**1. Explicit deny beats a broader grant.** `canEditTags` is not `EditTags || EditAll`. If the
payload carries `EditTags`, that value wins — including `false`, even when `EditAll` is `true`.
`EditAll` applies only when the field key is absent. The old hand-rolled OR granted access in
that case; that was a bug.

**2. `deleted` gates edits, not views.** Every `canEdit*` is false for a soft-deleted entity;
view and delete flags are not, because delete surfaces restore and purge.

> A control that **restores** a soft-deleted entity must derive from an *ungated* flag set.
> Gating the manage button on a `deleted`-aware flag removes the only way back — see
> `ungatedFlags` in `DataAssetsHeader`.

**3. Unknown access states fail closed.** `Access` is translated by an exhaustive `switch` whose
`default` returns `false`. If the backend ships a new access state before the generated enum
catches up, it denies rather than grants — this is the single seam every permission flows
through, so failing open here would grant access app-wide.

## The lint rule

`openmetadata-permissions/no-raw-permission-access` fails the build on direct reads of `EditAll`,
`ViewAll` and `ViewBasic`:

```
Raw permission access "EditAll" — use useEntityPermissions flags or can(Operation.EditAll) instead.
```

It exists because this class of logic re-scatters the moment it is convenient. If you are fighting
it, the flag you want probably exists; if it genuinely doesn't, use `can(Operation.X)`.

## Testing

Mock the hook, run the **real** derivation over a minimal permission object — that keeps the
assertions about permissions meaningful rather than asserting your own mock:

```ts
mockUseEntityPermissions.mockReturnValue({
  permissions, isLoading: false, error: null, refresh: jest.fn(),
  ...getDerivedPermissionFlags(permissions, false),
});
```

Components reaching the hooks need a `QueryClientProvider` — `renderWithQueryClient`
(`src/test/unit/test-utils.tsx`) supplies one. Without it React Query throws *"No QueryClient
set"*, which surfaces as a suite-wide failure rather than an assertion error.

## Changing behaviour

`src/utils/permissionPolicy.ts` collects the behavioural decisions with their blast radius
documented. Change policy there, once — not at call sites.

## Files

| Path | What |
|---|---|
| `src/hooks/useEntityPermissions/useEntityPermissions.ts` | the hook |
| `src/hooks/useEntityPermissions/useBulkEntityPermissions.ts` | list/bulk variant |
| `src/utils/PermissionDerivation.ts` | flag derivation |
| `src/utils/permissionPolicy.ts` | behavioural decisions |
| `src/utils/PermissionsUtils.ts` | `Access` → boolean translation |
| `eslint-rules/openmetadata-permissions.mjs` | the lint rule |
