# OpenMetadata with OpenBao (or HashiCorp Vault)

Runs the standard quickstart stack with `secretsManager.provider: managed-openbao`, so service
connection credentials are stored in OpenBao's KV v2 engine instead of being Fernet-encrypted into
the metadata database.

This is an **overlay** on `../docker-compose-quickstart/docker-compose.yml`, not a copy of it — it
adds an OpenBao service and points the server, the migration container and ingestion at it. Keeping
it an overlay means it cannot drift from the stack it extends.

OpenBao is the Linux Foundation fork of HashiCorp Vault. The two share the KV v2 paths and the
`X-Vault-*` headers, so the same provider works against either; only OpenBao is covered by automated
tests.

## Run it

```bash
cd docker/docker-compose-openbao
docker compose \
  -f ../docker-compose-quickstart/docker-compose.yml \
  -f docker-compose.openbao.yml \
  up -d
```

OpenMetadata comes up on <http://localhost:8585>, OpenBao on <http://localhost:8200>.

The `openbao-init` container creates a KV v2 mount, a least-privilege policy and an AppRole, then
exits. It is idempotent, so re-running the stack is safe.

## Check that it is actually working

The tempting check — grepping the database for the plaintext password — proves nothing: under the
default `db` provider the value is Fernet-encrypted, so the plaintext is absent either way. What
distinguishes the two is the *shape* of the stored value.

```bash
# 1. create a service with a password
curl -s -X PUT http://localhost:8585/api/v1/services/databaseServices \
  -H "Authorization: Bearer $OM_JWT" -H 'Content-Type: application/json' \
  -d '{"name":"bao-demo","serviceType":"Mysql","connection":{"config":{
        "type":"Mysql","scheme":"mysql+pymysql","username":"demo",
        "authType":{"password":"SUPERSECRET"},"hostPort":"mysql:3306"}}}'

# 2. the stored field must be a reference, not a credential
curl -s "http://localhost:8585/api/v1/services/databaseServices/name/bao-demo?fields=connection" \
  -H "Authorization: Bearer $OM_JWT" \
  | python3 -c 'import json,sys
v = json.load(sys.stdin)["connection"]["config"]["authType"]["password"]
assert v.startswith("secret:"), f"not a reference, provider is not writing to OpenBao: {v!r}"
print("path:", v.removeprefix("secret:").lstrip("/"))'

# 3. that path resolves in OpenBao to the real password
docker exec openmetadata_openbao bao kv get -address=http://127.0.0.1:8200 \
  -field=value openmetadata/<path-from-step-2>
```

Take the path from step 2 rather than assembling it. It is lower-cased throughout and includes the
cluster name and any configured prefix.

## Migrating an existing deployment

If you already run OpenMetadata on the `db` provider, existing credentials stay Fernet-encrypted in
the database until you move them:

```bash
docker exec execute_migrate_all ./bootstrap/openmetadata-ops.sh migrate-secrets
```

This is existing OpenMetadata tooling. Migrating **between** two external secrets managers is not
supported upstream — only `db` → external.

## Production

Dev mode is in-memory, unsealed, and wiped on restart, with a fixed root token. For a real
deployment, drop the `openbao` and `openbao-init` services and point the stack at your own server:

```bash
OM_SM_BAO_ADDRESS=https://openbao.internal:8200 \
OM_SM_BAO_MOUNT=openmetadata \
OM_SM_BAO_AUTH_METHOD=approle \
OM_SM_BAO_ROLE_ID=... \
OM_SM_BAO_SECRET_ID=... \
docker compose -f ../docker-compose-quickstart/docker-compose.yml -f docker-compose.openbao.yml up -d
```

The least-privilege policy the bootstrap script installs is the minimum that actually works —
established by running it, not by reasoning about it:

```hcl
path "openmetadata/data/*"     { capabilities = ["create", "read", "update", "delete"] }
path "openmetadata/metadata/*" { capabilities = ["read", "delete", "list"] }
path "openmetadata/config"     { capabilities = ["read"] }
```

`read` on `{mount}/config` matters: the server probes it once at startup to fail fast on a wrong
mount name. `sys/mounts` is deliberately not used, because a scoped token is refused it.

Two behaviours worth knowing before you adopt this:

- **Deleting a service destroys every version** of its secrets (`DELETE {mount}/metadata/{path}`),
  not just the latest. A soft delete leaves them in place — only a hard delete removes them.
- **Rotated credentials remain readable.** KV v2 keeps prior versions, so an old password stays
  retrievable to anyone with `read` on the mount. Set `max_versions` on the mount if that matters.

## Settings

All settings are optional except in production, where `OM_SM_BAO_ADDRESS` is required.

| Variable | Default | Notes |
|---|---|---|
| `OM_SM_BAO_ADDRESS` | `http://openbao:8200` | |
| `OM_SM_BAO_MOUNT` | `openmetadata` | KV v2 mount path |
| `OM_SM_BAO_NAMESPACE` | *(unset)* | Sent as `X-Vault-Namespace`; omitted entirely when blank |
| `OM_SM_BAO_AUTH_METHOD` | `token` | `token` or `approle` |
| `OM_SM_BAO_TOKEN` | `openbao-dev-root` | Dev only |
| `OM_SM_BAO_ROLE_ID` / `OM_SM_BAO_SECRET_ID` | *(unset)* | Required for `approle` |
| `OM_SM_BAO_AUTH_PATH` | `approle` | AppRole mount path |
| `OM_SM_BAO_CA_CERT_PATH` | *(unset)* | PEM bundle for a private CA |
| `OM_SM_BAO_SKIP_TLS_VERIFY` | `false` | Development only; logged at WARN |
| `OM_SM_BAO_CONNECT_TIMEOUT_MS` / `OM_SM_BAO_READ_TIMEOUT_MS` | `5000` / `10000` | |
