#!/bin/sh
# Prepare a dev OpenBao for OpenMetadata: a KV v2 mount, a least-privilege policy,
# and an AppRole. Safe to re-run: the mount and auth-method enables are guarded.
#
# One caveat — re-running MINTS A NEW secret ID each time and leaves earlier ones
# valid, so repeated runs accumulate live secret IDs on the role. Harmless for a
# throwaway dev instance; do not lift this script into anything longer-lived
# without adding secret-id cleanup.
#
# It also PRINTS the role_id and secret_id below. Run as the `openbao-init` compose
# service that means they land in `docker compose logs`, readable by anyone with
# access to the Docker daemon. Acceptable for a throwaway dev instance whose root
# token is a literal in the compose file; not acceptable anywhere else.
#
# Every capability in the policy below was established by running it, not by reasoning
# about it: with exactly these paths a scoped token can write, read and hard-delete a
# secret and probe the mount, while /v1/sys/mounts and other mounts return 403.
set -eu

MOUNT="${OM_BAO_MOUNT:-openmetadata}"
POLICY="${OM_BAO_POLICY:-openmetadata}"
ROLE="${OM_BAO_ROLE:-openmetadata}"

echo "==> waiting for OpenBao at ${BAO_ADDR}"
i=0
until bao status >/dev/null 2>&1; do
  i=$((i + 1))
  [ "$i" -gt 40 ] && { echo "OpenBao did not become ready" >&2; exit 1; }
  sleep 1
done

echo "==> enabling kv-v2 at ${MOUNT}/"
# `bao secrets enable` fails if the mount already exists; treat that as success so the
# script stays re-runnable.
if bao secrets list -format=json | grep -q "\"${MOUNT}/\""; then
  echo "    already enabled"
else
  bao secrets enable -path="${MOUNT}" -version=2 kv
fi

echo "==> writing policy ${POLICY}"
bao policy write "${POLICY}" - <<EOF
# Store, read and update the credential itself.
path "${MOUNT}/data/*" {
  capabilities = ["create", "read", "update", "delete"]
}

# Entity deletion issues DELETE on the metadata path, which removes every version.
# Without "delete" here, deleting a service would leave recoverable plaintext behind.
path "${MOUNT}/metadata/*" {
  capabilities = ["read", "delete", "list"]
}

# Read-only mount probe. The server checks this once at startup to fail fast on a
# typo'd mount name, which OpenBao otherwise reports as an ordinary 404 per-read.
path "${MOUNT}/config" {
  capabilities = ["read"]
}
EOF

echo "==> enabling approle auth"
if bao auth list -format=json | grep -q '"approle/"'; then
  echo "    already enabled"
else
  bao auth enable approle
fi

echo "==> creating approle ${ROLE}"
bao write "auth/approle/role/${ROLE}" \
  token_policies="${POLICY}" \
  token_ttl=20m \
  token_max_ttl=1h

ROLE_ID=$(bao read -field=role_id "auth/approle/role/${ROLE}/role-id")
SECRET_ID=$(bao write -f -field=secret_id "auth/approle/role/${ROLE}/secret-id")

echo
echo "==> OpenBao ready"
echo "    address : ${BAO_ADDR}"
echo "    mount   : ${MOUNT} (kv v2)"
echo "    role_id : ${ROLE_ID}"
echo "    secret_id: ${SECRET_ID}"
echo
echo "    To use AppRole instead of the dev root token, set on openmetadata-server:"
echo "      OM_SM_BAO_AUTH_METHOD=approle"
echo "      OM_SM_BAO_ROLE_ID=${ROLE_ID}"
echo "      OM_SM_BAO_SECRET_ID=${SECRET_ID}"
