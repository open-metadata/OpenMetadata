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
#   1. Bind-mount your file onto /fuseki/shiro.ini AND set
#      FUSEKI_RENDER_SHIRO=false — the entrypoint then skips the
#      envsubst render and leaves the mounted file in place.
#
#   2. Bind-mount onto /fuseki/shiro.ini.template instead of /fuseki/shiro.ini
#      and the entrypoint will envsubst your template (handy if you want
#      env-driven password injection in your custom realm too).
#
# Defaulting FUSEKI_RENDER_SHIRO=true preserves the prior, password-injection
# behavior for every dev/quickstart compose deployment that doesn't override
# it.

set -eu

: "${FUSEKI_ADMIN_PASSWORD:=admin}"
: "${FUSEKI_OPENMETADATA_PASSWORD:=openmetadata-secret}"
: "${FUSEKI_RENDER_SHIRO:=true}"
export FUSEKI_ADMIN_PASSWORD FUSEKI_OPENMETADATA_PASSWORD

if [ "$FUSEKI_RENDER_SHIRO" = "true" ] && [ -f /fuseki/shiro.ini.template ]; then
    # Restrict envsubst to the two variables we expect. Without an explicit
    # list, envsubst would interpret any `${...}` in the template — including
    # comments — which would silently blank out unrelated placeholders if
    # they were ever added.
    envsubst '${FUSEKI_ADMIN_PASSWORD} ${FUSEKI_OPENMETADATA_PASSWORD}' \
        </fuseki/shiro.ini.template \
        >/fuseki/shiro.ini
fi

exec "$@"
