# Data 360 connections require the org's My Domain, with no default

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** ingestion/tests/unit/source/database/data360/test_connection.py::test_a_config_without_a_salesforce_domain_is_rejected
- **Related:** [#37626](https://github.com/open-metadata/OpenMetadata/issues/37626); [#37627](https://github.com/open-metadata/OpenMetadata/pull/37627)

## Context

The Data 360 database and pipeline connections authenticate with the OAuth client-credentials
flow. Salesforce accepts that flow only on an org's My Domain and rejects it on `login` and
`test` with `invalid_grant: request not supported on this domain`. The schemas defaulted
`salesforceDomain` to `login`, so a connection that kept the default could never authenticate.

## Decision

`salesforceDomain` is required on both Data 360 connection schemas and has no default. It is the
org's My Domain without `.salesforce.com`, e.g. `mycompany.my`.

## Consequences

The service form asks for the domain instead of prefilling one that cannot work, and a config
without it fails validation rather than at login. The plain Salesforce connector still defaults to
`login`, because its username/password flow works there; that default does not apply to Data 360.
Revisit only if Data 360 gains an auth method that works on `login`.
