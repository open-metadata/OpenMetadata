# Indexed incident grouping lookup

Approved: implement and push optimization 2, then rebuild/restart localhost:8585 and benchmark the deployed API without deleting the scale fixture.

1. Add native 2.1.2 for MySQL/PostgreSQL: compact test-case projection and definition-membership projection, indexed for incident joins and grouping. Add bounded, source-row-locked backfill and replay tests.
2. Maintain each projection in source-table transactions with narrow triggers. Read JSON values in MySQL triggers because source fields are generated columns. Preserve null/deleted flags, multiple definition edges, and relationshipType identity. Test insert/update/delete/rollback, source-key rename, and duplicate memberships.
3. Route grouped reads and trend scoping through the projections. Keep owner relationships and existing filters. Verify both SQL dialects, response equivalence, and scale timing.
4. Record the design, format and independently review, commit/push the PR, build the distribution, migrate normally (no --force), restart only the app, and repeat the API benchmark. Preserve user compose edits and database/search volumes.
