#!/usr/bin/env bash
#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
# Gates the ingestion-base image on (a) absence of the five Debian 12 OS CVEs
# that failed the Collate Snyk gate, and (b) the native driver stack still
# working after the OS rebase. A clean CVE result with a broken ODBC or Oracle
# driver is not a pass.
#
# Usage: base_image_cve_test.sh <image-tag>

set -uo pipefail

IMAGE="${1:?usage: base_image_cve_test.sh <image-tag>}"
FAILURES=0
# NOTE: deliberately no --ignore-unfixed. These CVEs have no distro patch on
# bookworm, so --ignore-unfixed hides them and the test would pass vacuously.
TRIVY="docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest"
SCAN_OUT="$(mktemp)"
UNFILTERED_SCAN_OUT=""

# Only these three are assertable by CVE ID: Trivy has no advisory for
# CVE-2026-66032 / CVE-2026-66034 and reports zero hits for them even on the
# bookworm image that demonstrably carries the vulnerable libssh2-1 1.10.0-3+b1.
# Those two are covered by the package-version assertion further down instead.
TARGET_CVES="CVE-2023-45853 CVE-2026-34980 CVE-2026-45186"

fail() { echo "FAIL: $1"; FAILURES=$((FAILURES + 1)); }
pass() { echo "PASS: $1"; }

cleanup() { rm -f "$SCAN_OUT" "$UNFILTERED_SCAN_OUT"; }
trap cleanup EXIT

in_image() { docker run --rm --entrypoint bash "$IMAGE" -c "$1" 2>/dev/null; }

# Precondition. in_image discards stderr, so a docker run that never executes
# (missing tag, daemon down, socket permissions) is indistinguishable from a
# command that legitimately produced no output. That ambiguity would make the
# "vulnerable libssh2-1 not installed" branch below report a false PASS while
# never having inspected the image at all. Prove the image is runnable once, up
# front, so every later empty-output interpretation can be trusted.
if [ "$(in_image 'echo alive')" != "alive" ]; then
  echo "FAIL: cannot run ${IMAGE} — docker run produced no output (missing tag, or daemon/socket unavailable)"
  exit 1
fi

echo "== scanning ${IMAGE} =="
$TRIVY image --severity HIGH,CRITICAL "$IMAGE" > "$SCAN_OUT" 2>&1 || true
if ! grep -q "Total:" "$SCAN_OUT" && ! grep -qE '^\| ' "$SCAN_OUT"; then
  echo "FAIL: trivy produced no parseable report for ${IMAGE}"
  exit 1
fi

# Severity-filtered output is not reliable for the CVE-ID assertions: if a
# target CVE reappears at a severity Trivy/NVD disagree on it drops out of the
# HIGH,CRITICAL filter and the loop below would wrongly report it "absent"
# (CVE-2023-45853 is exactly this case -- Debian rates it unimportant, Trivy
# rates it CRITICAL only via NVD). Run a second, unfiltered scan solely for
# those assertions; keep the filtered scan above for everything else.
UNFILTERED_SCAN_OUT="$(mktemp)"
$TRIVY image "$IMAGE" > "$UNFILTERED_SCAN_OUT" 2>&1 || true
if ! grep -q "Total:" "$UNFILTERED_SCAN_OUT" && ! grep -qE '^\| ' "$UNFILTERED_SCAN_OUT"; then
  echo "FAIL: trivy produced no parseable unfiltered report for ${IMAGE}"
  exit 1
fi

echo "== CVE assertions =="
for c in $TARGET_CVES; do
  n="$(grep -c "$c" "$UNFILTERED_SCAN_OUT")"
  if [ "$n" -eq 0 ]; then pass "${c} absent"; else fail "${c} still present (${n} hit(s))"; fi
done

echo "== libssh2 version assertion (stands in for CVE-2026-66032 / CVE-2026-66034) =="
# Snyk flagged libssh2 1.10.0-3+b1 specifically. Trivy cannot see those two CVE
# IDs, so assert the vulnerable version is gone and the t64-renamed replacement
# is >= 1.11. Authoritative confirmation is Snyk in the Collate CI.
# NOTE: use dpkg-query's default tab-separated output plus `cut -f2`. Do NOT use
# -f/--showformat here: its ${Version} placeholder gets eaten by the nested
# host-shell -> docker -> container-bash quoting layers and silently yields an
# empty string, which would make these assertions pass or fail meaninglessly.
old="$(in_image 'dpkg-query -W libssh2-1 2>/dev/null | cut -f2')"
if [ -z "$old" ]; then
  pass "vulnerable libssh2-1 not installed"
else
  case "$old" in
    1.10.0*) fail "libssh2-1 still at vulnerable ${old}" ;;
    *)       pass "libssh2-1 present but not 1.10.0 (${old})" ;;
  esac
fi

new="$(in_image 'dpkg-query -W libssh2-1t64 2>/dev/null | cut -f2')"
if [ -z "$new" ]; then
  fail "libssh2-1t64 not installed (expected the trixie replacement, >= 1.11)"
else
  major_minor="$(printf '%s' "$new" | cut -d. -f1-2)"
  case "$major_minor" in
    1.1[1-9]|1.[2-9]*) pass "libssh2-1t64 ${new} (>= 1.11)" ;;
    *)                 fail "libssh2-1t64 ${new} is below 1.11" ;;
  esac
fi

echo "== OS release =="
os="$(in_image 'sed -n "s/^VERSION_ID=\"\{0,1\}\([0-9]\{1,\}\).*/\1/p" /etc/os-release')"
if [ "$os" = "13" ]; then pass "debian 13 (trixie)"; else fail "expected debian 13, got [${os}]"; fi

echo "== driver stack =="
# A successful build does not prove these load; each is a native extension or
# needs a registered ODBC driver.
for mod in MySQLdb psycopg2 oracledb confluent_kafka; do
  r="$(in_image "python -c 'import ${mod}' >/dev/null 2>&1 && echo ok || echo broken")"
  [ "$r" = "ok" ] && pass "import ${mod}" || fail "import ${mod} (${r:-no output})"
done

r="$(in_image 'odbcinst -j >/dev/null 2>&1 && echo ok || echo broken')"
[ "$r" = "ok" ] && pass "odbcinst runs" || fail "odbcinst runs (${r:-no output})"

r="$(in_image 'odbcinst -q -d 2>/dev/null | grep -c "ODBC Driver 18 for SQL Server"')"
[ "${r:-0}" -ge 1 ] && pass "msodbcsql18 registered" || fail "msodbcsql18 not registered"

# `import oracledb` succeeds without the Instant Client present -- only thick-mode
# initialization loads the .so. clientversion() then raises DPI-1047 if
# the library cannot be loaded against this OS's glibc, so it tests the thing the
# OS rebase could plausibly break, with no nested quoting to get wrong.
r="$(in_image 'python -c "import oracledb; oracledb.init_oracle_client(); print(oracledb.clientversion())" >/dev/null 2>&1 && echo ok || echo broken')"
[ "$r" = "ok" ] && pass "oracle instantclient loads" || fail "oracle instantclient did not load (${r:-no output})"

# Required at runtime by the Looker connector (GitPython shells out to git).
r="$(in_image 'git --version >/dev/null 2>&1 && echo ok || echo broken')"
[ "$r" = "ok" ] && pass "git present (Looker)" || fail "git present (Looker) (${r:-no output})"

r="$(in_image 'metadata --help >/dev/null 2>&1 && echo ok || echo broken')"
[ "$r" = "ok" ] && pass "metadata cli" || fail "metadata cli (${r:-no output})"

echo "---"
if [ "$FAILURES" -ne 0 ]; then
  echo "${FAILURES} check(s) failed for ${IMAGE}"
  exit 1
fi
echo "all checks passed for ${IMAGE}"
