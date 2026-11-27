# Indexed incident grouping lookup

Approved: implement and push optimization 2, then rebuild/restart localhost:8585 and benchmark the deployed API without deleting the scale fixture.

1. Add native 2.1.2 for MySQL/PostgreSQL: a generated table key derived from test-case JSON. MySQL's covering index includes the hash, deleted flag, ID and full table key. PostgreSQL stores the generated key without adding an unmeasured index that cannot safely cover a potentially wide UTF-8 key.
2. Use the generated key in grouping queries. Database-generated values synchronize every write path, including bulk updates, renames, deletes and rollback. Preserve existing relationship joins and group semantics.
3. Test real migration replay, existing and new rows, rename/soft-delete/restore, rollback, wide UTF-8 values, grouping and trend results. Run MySQL checks as a schema-scoped user with binary logging enabled.
4. Format and independently review, commit/push, build the distribution, migrate normally (no --force), restart only the app, and repeat the full API benchmark. Preserve local branch changes, compose edits and database/search volumes.

The first design used compact projection tables and triggers. Independent review rejected it before deployment because managed MySQL may refuse trigger creation under normal deployment credentials. The generated-key index avoids that privilege requirement and requires no application-side synchronization hooks.
