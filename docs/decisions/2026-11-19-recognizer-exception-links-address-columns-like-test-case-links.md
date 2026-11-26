# A recognizer exception's entityLink addresses its column the way a test case link does

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** vamsibvv (proposed in #38162; maintainers review)
- **Guard:** `ingestion/tests/unit/metadata/pii/test_tag_scoring.py`
  (`test_exception_list_filtering*`)
- **Related:** #38161, #38162, ADR:2026-10-27-nested-column-dq-tests-address-nested-paths

## Context
`TagAnalyzer.should_skip_recognizer` decides whether a recognizer exception covers the column being
classified. It built the column's entityLink by splitting the column FQN on every `.`, which breaks
a quoted name apart (`svc.db.sch.users."user.email"` became
`<#E::table::svc.db.sch.users."user::columns::email">`) and moves a nested column's parent into the
table name, so no exception for those columns ever matched. Clients send the link and
`RecognizerFeedbackRepository.addExceptionToRecognizer` stores it unchanged, so ingestion has to
read whatever form a client wrote.

## Decision
A recognizer exception's entityLink is `<#E::table::<table FQN>::columns::<column path>>`, where the
table FQN keeps its quotes and the column path is the column's FQN below the table, as for test
cases in ADR:2026-10-27-nested-column-dq-tests-address-nested-paths: a nested column is a dotted path
(`contact.email`), and a column whose own name contains a dot is quoted (`"user.email"`). Ingestion
turns each link into the column FQN it names (table FQN, `.`, column path) and compares it with the
column's FQN; it does not rebuild a link from the column FQN.

A bare dotted path (`user.email`) names the nested column only. Unlike test case resolution, the
analyzer does not see the table's other columns, so it cannot fall back to a literal dotted name
when no nested path exists; reading the bare form as both would let an exception for a nested
field also silence an unrelated column named `user.email`.

## Consequences
Writers must quote a column name that contains a dot. An exception stored with a bare dotted path
for such a column does not apply to it (none applied before this record either, since the link the
analyzer built never matched). Accepting the bare form for a literal name would need the table's
columns at classification time, with the nested path taking precedence as for test cases.
