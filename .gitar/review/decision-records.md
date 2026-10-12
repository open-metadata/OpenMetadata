# Decision records

`docs/decisions/` holds dated records of the choices that shape this codebase; its `README.md` has
the format and the triggers below. In addition to standard code review, apply two checks to every
pull request. They are different findings: one asks whether the change **contradicts** a record,
the other whether it **decides something and records nothing**.

## A change that contradicts an Accepted record

When a changed line undoes what an Accepted record states, report a blocking review finding: either
the change is wrong, or the pull request must add a record that supersedes the old one, whose
`Status` then names its successor. Read the records the touched code cites as `ADR:<date>-<slug>` —
the citation is the path `docs/decisions/<date>-<slug>.md` — and any record whose subject the diff
changes.

## A decision the tree does not record

Report a blocking review finding when the pull request does any of the following and no record,
added in this pull request or already in `docs/decisions/`, states that particular rule. A pull
request that adds one record is not thereby covered for a second decision it also makes.

- It introduces a contract another component or repository has to agree with: a JSON Schema field
  or enum value, a REST path or parameter, an event or payload shape, or a derived format such as
  an FQN encoding, a hash, or an index or alias name.
- It sets a new default, limit, batch size, cap, timeout or retry budget, and the value was a
  judgment call.
- It relies on an ordering or mutual exclusion that must hold for correctness and is not visible
  from a single file: migration order, registration or initialization order, lock order.
- Its description states a rule in prose that exists nowhere in the tree. The repository
  squash-merges, so the description never reaches `git log`.
- It is the third pull request iterating on the same trade-off.

Not a trigger: a bug fix whose correctness is evident from the diff, a refactor with no behavior
change, a dependency bump, a test-only change, or a change that merely complies with an existing
record.

Name the rule; do not ask for paperwork. "This needs an ADR" is not actionable: state the sentence
the record would assert and quote the part of the description it comes from. Raise it once — when
the author has answered that no rule survives the change, or the record has since been added, do
not raise it again.

Do not suppress, replace or downgrade standard reliability, security or maintainability findings
when applying these checks.
