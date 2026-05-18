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
# custom realms, …) can bind-mount their own file onto /fuseki/shiro.ini —
# the entrypoint overwrites that path so the mount would lose; in that case
# replace the entrypoint via `--entrypoint` on `docker run` or override
# `entrypoint:` in compose so this script doesn't render.

set -eu

: "${FUSEKI_ADMIN_PASSWORD:=admin}"
: "${FUSEKI_OPENMETADATA_PASSWORD:=openmetadata-secret}"
export FUSEKI_ADMIN_PASSWORD FUSEKI_OPENMETADATA_PASSWORD

if [ -f /fuseki/shiro.ini.template ]; then
    # Restrict envsubst to the two variables we expect. Without an explicit
    # list, envsubst would interpret any `${...}` in the template — including
    # comments — which would silently blank out unrelated placeholders if
    # they were ever added.
    envsubst '${FUSEKI_ADMIN_PASSWORD} ${FUSEKI_OPENMETADATA_PASSWORD}' \
        </fuseki/shiro.ini.template \
        >/fuseki/shiro.ini
fi

exec "$@"
