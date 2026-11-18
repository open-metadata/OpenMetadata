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
(`contact.email`), and a column whose own name contains a dot is quoted (`"user.email"`). For links
already stored, a bare dotted path (`user.email`) is also read as the quoted name. Ingestion turns
each link into the column FQNs it can name and compares them with the column's FQN; it does not
rebuild a link from the column FQN.

## Consequences
Writers should send the quoted form for a name with a dot, which is the column's segment in its
FQN. A bare dotted path that is both a nested path and a literal top-level column name matches both
columns. Accepting the bare form could be dropped once no stored exception uses it.
