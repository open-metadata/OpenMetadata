# DAO statements bind every value; only identifiers are template attributes

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `DaoStatementGuardTest`, `EntityDAOTest` (`*_bindsEntityNames*`)
- **Related:** open-metadata/openmetadata-collate#8018

## Context
The prefix renames (`EntityDAO.updateFqn`, the container override, the `tag_usage` prefix rewrites,
the thread-link rename) were built with `String.format` and handed to JDBI as one `@Define`
attribute (`@SqlUpdate("<update>")`). The values in them are entity names, which users choose, and
escaping them before rendering is not reliable: JDBI's `ColonPrefixSqlParser` re-lexes the rendered
statement with its own string-literal rules. Names with quotes or backslashes also failed to match
the JSON text they were meant to rewrite. The tag list's usage-count query was built the same way,
and because it hashed the whole FQN with `MD5()` while `fqnHash` hashes each segment, it reported 0
for every tag.

## Decision
- A DAO statement is a constant in its annotation. Values (names, FQNs, hashes, LIKE patterns) are
  bound with `@Bind`; only identifiers the code chooses, such as a table name, may be `@Define`
  attributes. No statement is a bare template attribute.
- A LIKE pattern built from a name goes through `ListFilter.escapeLikeBindValue` before binding.
- On MySQL, `updateFqn` swaps the prefix by length (`CONCAT`/`SUBSTRING`): `fqnHash LIKE 'oldHash.%'`
  already selects only rows under the prefix, so no regular expression is needed. A replacement over
  JSON text binds the prefix as serialized JSON writes it (`EntityDAO.jsonFqnPrefix`).

## Consequences
Dialect-specific statements are `@ConnectionAwareSqlUpdate` pairs over one set of bound names;
production JDBI allows unused bindings. The guard only recognizes whole-statement attributes, so a
value hidden in a narrower attribute (`<cond>`) is still a reviewer's call. Tag usage counts take one
query per tag until a bound batch query replaces them.
