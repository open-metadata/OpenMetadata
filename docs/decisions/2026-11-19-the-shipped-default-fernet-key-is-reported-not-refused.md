# The shipped default Fernet key is reported on startup and on the status page, never refused

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `FernetDefaultKeyTest`, `SystemRepositoryEncryptionKeyStatusTest`
- **Related:** `conf/openmetadata.yaml` `fernetConfiguration`

## Context

`conf/openmetadata.yaml` falls back to a fixed Fernet key when `FERNET_KEY` is not set, and the
Docker Compose files set the same value. Each deployment should encrypt its stored secrets with a
key of its own, and its operators need to see when it does not.

## Decision

While the first key of `fernetConfiguration.fernetKey` is the shipped default, compared by value
after the base64 to base64url conversion `Fernet` already applies, or while no key is configured
(`no_encryption_at_rest`):

- the server logs an error on every start, from `Fernet.setFernetKey(config)`, so the server and
  every ops command report it;
- `/api/v1/system/status` carries a failed `Encryption Key` step, which the Health Check page shows.

Only the first key counts, because it is the one that encrypts new values. A list with an own key
first and the default after it passes: that is how a deployment moves off the default without
losing the secrets stored with it.

The liveness probes (`/api/v1/system/health` and the admin `/healthcheck`) do not report it, and
the server still starts.

## Consequences

Upgrades never stop over the key, and liveness stays a pure process check. Refusing to start with
the default key would need a release note one release ahead and a reversal of this record.
