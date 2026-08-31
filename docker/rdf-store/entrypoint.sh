#!/bin/sh
#
# Render shiro.ini from its template, substituting FUSEKI_ADMIN_PASSWORD and
# FUSEKI_OPENMETADATA_PASSWORD. Apache Shiro's INI realm does not interpolate
# ${VAR} placeholders natively, so we have to expand them before Fuseki reads
# the file — otherwise Shiro stores the literal string `${FUSEKI_...}` as the
# password and every basic-auth attempt returns 401.
#
# Defaults: admin / admin and openmetadata / openmetadata-secret. Operators
# who want different credentials set the env vars in their compose / k8s
# deployment manifest — that override now actually takes effect.
#
# Operators who need to fully replace shiro.ini (different role layout,
# custom realms, …) have two options:
#
#   1. Place your file at $FUSEKI_BASE/shiro.ini on the data volume (default
#      /fuseki-data/fuseki-base/shiro.ini) AND set FUSEKI_RENDER_SHIRO=false —
#      the entrypoint then skips the envsubst render and leaves your file in
#      place. (Fuseki loads shiro.ini from FUSEKI_BASE, which lives on the
#      volume so admin-created datasets survive container recreation.)
#
#   2. Bind-mount onto /fuseki/shiro.ini.template and the entrypoint will
#      envsubst your template into $FUSEKI_BASE/shiro.ini (handy if you want
#      env-driven password injection in your custom realm too).
#
# Defaulting FUSEKI_RENDER_SHIRO=true preserves the prior, password-injection
# behavior for every dev/quickstart compose deployment that doesn't override
# it.

set -eu

: "${FUSEKI_ADMIN_PASSWORD:=admin}"
: "${FUSEKI_OPENMETADATA_PASSWORD:=openmetadata-secret}"
: "${FUSEKI_RENDER_SHIRO:=true}"
: "${FUSEKI_BASE:=/fuseki-data/fuseki-base}"
export FUSEKI_ADMIN_PASSWORD FUSEKI_OPENMETADATA_PASSWORD FUSEKI_BASE

# FUSEKI_BASE lives on the data volume so admin-created datasets (blue/green
# rebuild targets) and their registrations survive container recreation. The
# volume may be empty on first boot, or root-owned if it predates the non-root
# image — fail with a clear remediation rather than letting Fuseki boot into
# opaque permission errors.
mkdir -p "$FUSEKI_BASE" 2>/dev/null || true
if [ ! -w "$FUSEKI_BASE" ] || [ ! -w /fuseki-data ]; then
    echo "ERROR: /fuseki-data (or $FUSEKI_BASE) is not writable by uid $(id -u)." >&2
    echo "This image runs as the non-root 'fuseki' user (uid 1000)." >&2
    echo "Fix: chown -R 1000:1000 the volume, or set securityContext.fsGroup: 1000 in Kubernetes." >&2
    exit 1
fi

if [ "$FUSEKI_RENDER_SHIRO" = "true" ] && [ -f /fuseki/shiro.ini.template ]; then
    # Restrict envsubst to the two variables we expect. Without an explicit
    # list, envsubst would interpret any `${...}` in the template — including
    # comments — which would silently blank out unrelated placeholders if
    # they were ever added.
    #
    # Rendered into FUSEKI_BASE because that is where Fuseki loads shiro.ini
    # from; the template stays read-only in the image.
    envsubst '${FUSEKI_ADMIN_PASSWORD} ${FUSEKI_OPENMETADATA_PASSWORD}' \
        </fuseki/shiro.ini.template \
        >"$FUSEKI_BASE/shiro.ini"
fi

exec "$@"
