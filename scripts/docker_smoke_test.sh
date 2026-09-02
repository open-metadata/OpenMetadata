#!/usr/bin/env bash
#  Copyright 2026 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
# Smoke test for the server image. Deliberately needs no database and no search
# cluster: everything asserted here is a property of the *image* -- that the JDK
# resolves the whole application classpath, the glibc libraries the JNI natives
# link against, the writable log directory, the non-root uid, the shell the
# launch scripts need, the absence of a package manager, and the JVM owning
# PID 1. A stack-level test belongs in the integration workflows, not here.
#
#   ./scripts/docker_smoke_test.sh [image-tag]
#
# Requires openmetadata-dist/target/openmetadata-*.tar.gz (mvn -DskipTests package).

set -euo pipefail

IMAGE="${1:-openmetadata-server:smoke}"
CONTAINER="om-smoke-$$"
WORKDIR_TMP="$(mktemp -d)"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

failures=0
pass() { echo "  PASS  $1"; }
fail() { echo "  FAIL  $1"; failures=$((failures + 1)); }

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORKDIR_TMP"
}
trap cleanup EXIT

echo "==> Preflight"
if ! compgen -G "openmetadata-dist/target/openmetadata-*.tar.gz" >/dev/null; then
  echo "missing openmetadata-dist/target/openmetadata-*.tar.gz -- run 'mvn -DskipTests package' first"
  exit 1
fi

# The two Dockerfile.dockerignore files are allowlists, so a path that gets
# deleted or renamed leaves behind a `!` line that re-includes nothing. That is
# harmless to the build and therefore invisible -- which is exactly how the two
# sibling files drift apart.
stale_includes=""
for ignore in docker/docker-compose-quickstart/Dockerfile.dockerignore \
              docker/development/Dockerfile.dockerignore; do
  while IFS= read -r entry; do
    path="${entry#!}"
    case "$path" in
      *[*?]*) compgen -G "$path" >/dev/null 2>&1 || stale_includes="$stale_includes $ignore:$path" ;;
      *)      [ -e "${path%/}" ] || stale_includes="$stale_includes $ignore:$path" ;;
    esac
  done < <(grep '^!' "$ignore")
done
if [ -n "$stale_includes" ]; then
  echo "stale .dockerignore re-include(s), the path no longer exists:$stale_includes"
  exit 1
fi

# Same rot, different file: the workflow's `docker:` path filter decides whether
# this smoke test runs at all, so an entry left pointing at a deleted file makes
# the gate quietly narrower than it reads. That is how docker/Health.java
# survived in the filter after the file was removed.
WORKFLOW=".github/workflows/openmetadata-service-unit-tests.yml"
stale_filters=""
while IFS= read -r entry; do
  probe="${entry%/\*\*}"
  case "$probe" in
    *[*?]*) compgen -G "$probe" >/dev/null 2>&1 || stale_filters="$stale_filters $entry" ;;
    *)      [ -e "$probe" ] || stale_filters="$stale_filters $entry" ;;
  esac
done < <(awk '/^ *docker:$/{f=1;next} f && /^ *[a-z_]+:$/{f=0} f' "$WORKFLOW" \
           | sed -n "s/^ *- '\(.*\)'$/\1/p")
if [ -n "$stale_filters" ]; then
  echo "stale docker path-filter entr(ies) in $WORKFLOW, the path no longer exists:$stale_filters"
  exit 1
fi

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "==> Building $IMAGE"
  docker build -f docker/development/Dockerfile -t "$IMAGE" .
else
  echo "==> Using pre-built $IMAGE"
fi

echo
echo "==> Assertions"

user="$(docker image inspect "$IMAGE" --format '{{.Config.User}}')"
if [ "$user" = "65532:65532" ]; then
  pass "image runs as the numeric non-root uid ($user)"
else
  # A name here is not cosmetic: the kubelet rejects a non-numeric user under
  # `runAsNonRoot: true` with no explicit `runAsUser`.
  fail "expected USER 65532:65532, got '${user:-<unset>}'"
fi

# The launch scripts, bootstrap/openmetadata-ops.sh, the compose healthchecks and
# the helm chart all name these paths. The debug base ships busybox on PATH but
# leaves /bin empty, so the Dockerfile links them in and this is the guard.
for shell in /bin/sh /bin/bash; do
  if docker run --rm --entrypoint "$shell" "$IMAGE" -c 'exit 0' >/dev/null 2>&1; then
    pass "$shell works"
  else
    fail "$shell is missing or broken -- the entrypoint and openmetadata-ops.sh both need it"
  fi
done

# Losing apt/apk is most of what distroless buys once the shell stays: no
# in-place upgrade path means OS CVEs get fixed by bumping the base tag rather
# than by an upgrade layer. A hit under /busybox does not count -- busybox ships
# `dpkg` and `dpkg-deb` applets that cannot reach a repository.
package_managers=""
for pm in apt apt-get dpkg apk yum microdnf rpm; do
  found="$(docker run --rm --entrypoint /bin/sh "$IMAGE" -c "command -v $pm" 2>/dev/null || true)"
  case "$found" in
    ""|/busybox/*) ;;
    *) package_managers="$package_managers $pm($found)" ;;
  esac
done
if [ -n "$package_managers" ]; then
  fail "image ships a real package manager --$package_managers -- the base is no longer distroless"
else
  pass "image ships no package manager outside busybox's applets"
fi

version="$(docker run --rm --entrypoint java "$IMAGE" -version 2>&1 || true)"
if echo "$version" | grep -q 'version "21'; then
  pass "the java runtime starts and reports Java 21"
else
  fail "the java runtime did not report Java 21: $(echo "$version" | head -3 | tr '\n' ' ')"
fi

# Why the base is cc-debian13 and not base-debian12, cc-debian12 or alpine.
# libstdc++/libgcc are what DJL's libtokenizers.so and onnxruntime link; libz is
# what libtorch's libgfortran links, and cc-debian12 ships every one of those
# except libz. All three have to resolve inside the image or the natives will not
# load at all.
docker create --name "$CONTAINER" "$IMAGE" >/dev/null
for lib in libstdc++.so.6 libgcc_s.so.1 libz.so.1; do
  found=""
  for dir in /usr/lib/x86_64-linux-gnu /lib/x86_64-linux-gnu /usr/lib/aarch64-linux-gnu /lib/aarch64-linux-gnu /usr/lib; do
    if docker cp "$CONTAINER:$dir/$lib" "$WORKDIR_TMP/" >/dev/null 2>&1; then found="$dir"; break; fi
  done
  if [ -n "$found" ]; then
    pass "$lib is present ($found)"
  else
    fail "$lib is missing -- the JNI natives the server loads will not link"
  fi
done
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

# Runs bootstrap/openmetadata-ops.sh exactly the way compose and the helm chart
# do -- through the shell entrypoint -- so this covers the launch script, the
# classpath it assembles from libs/, and every JDK module the app touches in one
# shot. It
# cannot reach a database and is expected to fail on that; what matters is that
# it does not fail on a missing module or an unresolvable class.
ops="$(docker run --rm "$IMAGE" \
  /opt/openmetadata/bootstrap/openmetadata-ops.sh --help 2>&1 || true)"
if echo "$ops" | grep -qE 'NoClassDefFoundError|ClassNotFoundException|UnsatisfiedLinkError|FindException|module .* not found'; then
  echo "$ops" | grep -E 'NoClassDefFoundError|ClassNotFoundException|UnsatisfiedLinkError|FindException|module .* not found' | head -5
  fail "openmetadata-ops.sh hit a class-loading or module error -- the image is missing a class or a JDK module"
else
  pass "openmetadata-ops.sh runs through the shell and resolves every class it needs"
fi

# -Xlog:gc writes here on every startup, and so do the logback file appenders in
# conf/openmetadata.yaml. There is no mkdir in the image, so the directory has to
# arrive already created and already owned by 65532.
docker run --name "$CONTAINER" --entrypoint java "$IMAGE" \
  -Xlog:gc:file=/opt/openmetadata/logs/smoke-gc.log -version >/dev/null 2>&1 || true
if docker cp "$CONTAINER:/opt/openmetadata/logs/smoke-gc.log" "$WORKDIR_TMP/gc.log" >/dev/null 2>&1 &&
   [ -s "$WORKDIR_TMP/gc.log" ]; then
  pass "/opt/openmetadata/logs is writable by uid 65532"
else
  fail "/opt/openmetadata/logs is not writable by uid 65532 -- logging will fail at startup"
fi
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

# The JVM has to be PID 1 or `docker stop` and pod termination never reach
# Dropwizard's shutdown hooks: the shell that would otherwise be PID 1 does not
# forward signals, so the container is SIGKILLed once the grace period ends.
# openmetadata-start.sh execs for exactly this reason. Asserted against a
# container with no database behind it -- it exits on its own after ~10s, which
# is a wide enough window to read /proc/1.
docker run -d --name "$CONTAINER" "$IMAGE" >/dev/null
pid1=""
for _ in 1 2 3 4 5 6 7 8; do
  pid1="$(docker exec "$CONTAINER" /bin/sh -c 'tr "\0" " " < /proc/1/cmdline' 2>/dev/null || true)"
  [ -n "$pid1" ] && break
  sleep 1
done
case "$pid1" in
  *OpenMetadataApplication*) pass "the JVM runs as PID 1, so SIGTERM reaches Dropwizard" ;;
  "") fail "could not read /proc/1 before the container exited" ;;
  *) fail "PID 1 is '${pid1%% *}', not the JVM -- docker stop will SIGKILL instead of shutting down" ;;
esac
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

echo
if [ "$failures" -ne 0 ]; then
  echo "==> $failures assertion(s) failed for $IMAGE"
  exit 1
fi

echo "==> All smoke assertions passed for $IMAGE"
