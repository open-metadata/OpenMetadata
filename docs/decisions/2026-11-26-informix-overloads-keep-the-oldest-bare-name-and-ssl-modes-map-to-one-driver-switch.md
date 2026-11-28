# Informix overloads keep the oldest routine on the bare name, and every sslMode maps onto the driver's one SSL switch

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** ingestion maintainers
- **Guard:** `ingestion/tests/unit/topology/database/test_informix.py` (`TestStoredProcedures`, `TestSslPolicy`, `TestTrustServerCertificate`, `TestClasspath`)
- **Related:** open-metadata/OpenMetadata#34049

## Context
Informix services were already in production on a connector that published every overload of a
routine under its bare name (so they overwrote each other), mapped every `sslMode` except `disable`
to an encrypted session, and located its driver through `INFORMIX_JDBC_JARS`. The connector here
replaces it, so its stored-procedure FQNs, SSL behaviour and driver lookup are contracts those
services already depend on: changing them moves curated metadata off the entities it was written
for, or stops a working connection.

Informix allows overloading, `sysprocedures` has no stable per-routine key a user always sets
(`specificname` is optional), and the IBM JDBC driver has exactly one SSL property,
`SSLCONNECTION`, verifying against a Java truststore and never matching the host name.

## Decision
- **Overloads.** For each routine name, the overload with the lowest `procid` (the oldest) is
  published under the bare name; every other overload is published as `name(paramtypes)`. Naming
  is decided over the unfiltered list, so a filter never renames a routine. A filter pattern is
  matched against both the bare name and, for an overloaded routine, the signature: an include
  matching either keeps it, an exclude matching either drops it.
- **`sslMode`.** `disable` or unset: plaintext. `require`, `allow`, `prefer`: encrypted, the
  certificate not verified (the JVM default `SSLContext` is swapped for one trusting any
  certificate for the length of the connect, under a lock every Informix SSL connect takes).
  `verify-ca`, `verify-full`: encrypted and verified against a JKS truststore built from
  `sslConfig.caCertificate`, or against the JVM default truststore when none is given;
  `verify-full` does not match the host name and logs that it does not.
- **Driver.** `INFORMIX_JDBC_JARS`, an `os.pathsep`-separated list, replaces the pinned jars when set.

## Consequences
Existing entities keep their FQNs, and a routine that gains an overload keeps its name. The cost:
dropping the oldest overload while newer ones remain hands the bare name, and the curated metadata
on it, to the next-oldest; there is no stable key to prevent it. `verify-full` is weaker than its
name until the driver matches host names or the connector enforces it in the trust manager.
Revisit the overload rule if Informix gains a mandatory stable routine identifier, and the
`verify-full` mapping when host-name checking is implemented.
