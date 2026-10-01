# In the Dremio connector the URL scheme decides whether TLS is used, and `verifySSL` only chooses how the certificate is checked

- **Status:** Accepted
- **Revisions:** v1 2026-10-24 (initial)
- **Deciders:** Charly Clairmont
- **Guard:** `TestSoftwareTls` in `ingestion/tests/unit/source/database/dremio/test_connection.py`
- **Related:** [#34366](https://github.com/open-metadata/OpenMetadata/issues/34366), [PR #36163](https://github.com/open-metadata/OpenMetadata/pull/36163); `security/ssl/verifySSLConfig.json`

## Context

The Dremio Software connection reuses the shared `verifySSL` enum (`no-ssl`, `ignore`, `validate`)
and `sslConfig`. For other connectors `no-ssl` means that the connection does not use TLS. For
Dremio, whether a server answers in TLS is already told by the `hostPort` URL, and the default
value of the enum, `no-ssl`, must keep working for a server whose certificate is signed by a public
authority.

## Decision

TLS is used if and only if the scheme of `hostPort` is `https`. `verifySSL` then only chooses how
the certificate is checked:

- `no-ssl` (the default): against the trusted authorities of the system;
- `ignore`: not checked, for a self-signed certificate (a warning is logged);
- `validate`: against the CA certificate of `sslConfig`; without one, as `no-ssl` (a warning is
  logged).

With an `http` URL, `verifySSL` and `sslConfig` have no effect. Client certificates (the key and
certificate fields of `sslConfig`) are not supported by the connector and are not read.

## Consequences

An `https` Dremio with a public certificate works with the default configuration. The value
`no-ssl` does not mean "no TLS" here, which differs from the other connectors and is written in the
description of the field. Mutual TLS needs a new decision: the driver has no option for a client
certificate today.
