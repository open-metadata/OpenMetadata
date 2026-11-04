# DAO statements bind every value; only identifiers are template attributes

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `DaoStatementGuardTest`, `EntityDAOTest` (`*_bindsEntityNames*`)
- **Related:** open-metadata/openmetadata-collate#8018

## Context
The prefix renames (`EntityDAO.updateFqn`, the container override, the `tag_usage` prefix rewrites,
the thread-link rename) and the tag list's usage count put entity names into SQL. Escaping a name
into statement text is not dependable under JDBI: `ColonPrefixSqlParser` re-lexes the rendered
statement with its own string-literal rules. So values travel as bound parameters, and a
statement's text holds only what the code chooses.

## Decision
- A DAO statement is a constant in its annotation. Values (names, FQNs, hashes, LIKE patterns) are
  bound with `@Bind`; only identifiers the code chooses, such as a table name, may be `@Define`
  attributes. No statement is a bare template attribute.
- A LIKE pattern built from a name goes through `ListFilter.escapeLikeBindValue` before binding.
- On MySQL, `updateFqn` swaps the prefix by length (`CONCAT`/`SUBSTRING`): `fqnHash LIKE 'oldHash.%'`
  already selects only rows under the prefix, so no regular expression is needed. A replacement over
  JSON text binds the prefix as serialized JSON writes it (`EntityDAO.jsonFqnPrefix`), so a name
  with quotes or backslashes matches the text it rewrites.
- A tag list counts usage with the bound per-tag query, so `usageCount` matches what a GET returns.

## Consequences
Dialect-specific statements are `@ConnectionAwareSqlUpdate` pairs over one set of bound names;
production JDBI allows unused bindings. The guard only recognizes whole-statement attributes, so a
value hidden in a narrower attribute (`<cond>`) is still a reviewer's call. Tag usage counts take one
query per tag until a bound batch query replaces them. `ListFilter.escapeForMySqlRegexReplacement`
stays, deprecated, for extensions that still render such statements until they bind them too.
