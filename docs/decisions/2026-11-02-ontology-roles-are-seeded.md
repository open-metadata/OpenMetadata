# Ontology author and reviewer roles are seeded and attached to DataSteward

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Ontology Studio program
- **Guard:** `OntologyRolesIT`, `OntologyRolesMigrationIT`, `OntologyOwnerInheritanceTest`
- **Related:** ADR:2026-11-02-ontology-reviewers-vote-without-edit-rights (v4 states what a DataSteward edits), `OntologyRolesMigration`

## Context
Ontology writes need edit rights. No built-in role named an ontology resource, so only an
administrator or a custom role could author, and a DataSteward saw no create action in Studio.

## Decision
- Seed `OntologyAuthorPolicy` (Create, Delete, ViewAll, EditAll on `ontology`, `ontologyConcept`,
  `ontologyProperty`, `ontologyAxiom`, `ontologyChangeSet`; ViewAll and CreateTask on
  `ontologyRelease`) and `OntologyReviewerPolicy` (ViewAll only), with the roles `OntologyAuthor`
  and `OntologyReviewer`.
- `DataSteward` carries both policies. To keep authoring opt-in, remove them from
  `DataSteward.json` and from the migration step, and assign the roles per person.
- Installed catalogs get the same attachment from the `ontology-roles-on-data-steward` step in the
  existing v210 data migration, not a new version. Seed data is created only when missing, so it
  never reaches an existing role. The latest migration version is reprocessed on every start, and
  v210 has gained steps since `2.1.0-rc1`, so a step guarded by `runOnce` reaches rc1 installs. A
  new version would need empty schema files for nothing.
- Seed is create-if-missing, so an administrator's edit to either policy survives a restart.
- Concepts, properties and axioms with no owner report the ontology's owners
  (`OntologyEntityRepository`), so an ontology owner edits what the ontology holds.

## Consequences
- Stewards can create and edit ontologies after upgrade, and cannot lose that by being listed as
  reviewers.
- Removing a policy from DataSteward by hand sticks until the step is next recorded as not run.
