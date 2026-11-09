# Only data assets can be claimed by default

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `OrganizationPolicyDefaultsTest`, `OrganizationPolicyClaimSqlMigrationTest`,
  `OrganizationPolicyDefaultsIT`

## Context
The Organization Policy applies to every user. One of its rules lets anyone set the owner of an item
that has no owner, so that data nobody looks after gets an owner. Another lets the owner of an item
do everything on it. The first rule covered every item type, including policies, teams, alerts and
apps, which configure the platform rather than describe data.

## Decision
- `OrganizationPolicy-NoOwner-Rule` names the item types that can be claimed: the types that live
  inside a service and describe something in the source system (`apiCollection`, `apiEndpoint`,
  `chart`, `container`, `dashboard`, `dashboardDataModel`, `database`, `databaseSchema`,
  `directory`, `file`, `llmModel`, `mcpServer`, `mlmodel`, `pipeline`, `query`, `report`,
  `searchIndex`, `spreadsheet`, `storedProcedure`, `table`, `topic`, `worksheet`). Ingestion
  pipelines live in a service but are OpenMetadata's own setup, so they are not named. Like every
  other shipped rule, it names its types instead of introducing a group of types.
- `OrganizationPolicy-OwnerNoPolicyEdit-Rule` denies `EditAll` and `Delete` on a policy to its
  owner. A policy decides what others may do, so owning one does not let a non-admin change it.
  Teams also hold policies and roles; adding either to a team is already admin-only
  (ADR:2026-10-30-only-admins-add-roles-or-policies-to-a-team).
- Both are default rules, so organizations can change them. An upgrade narrows the claim rule only
  where it still reads as shipped, and adds the deny rule to every installation, since a deny only
  removes access (ADR:2026-11-03-seeded-policies-are-not-reset-on-startup).
- `OrganizationPolicyDefaultsTest` fails when an entity type with a `service` field is neither named
  in the claim rule nor listed as not claimable, and when an entity type with owners and a field
  that holds policies, roles or rules is neither named in the deny rule nor listed with what limits
  its owners instead.

## Consequences
- Users with the default roles claim data assets as before. Admins and Data Stewards set the owner of
  other items, and the person who creates an item can give it an owner.
- A new data asset type can be claimed once it is named in the rule. Installations upgraded from an
  earlier release need a migration statement that adds it to a claim rule still reading as shipped.
- Owners set before the upgrade stay.
- The owner of a policy cannot edit its description, while other users can, because description edits
  are allowed on every item by `DataConsumerPolicy-EditRule`.
