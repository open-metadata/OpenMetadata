#!/usr/bin/env bash
#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# Patch vulnerable jars bundled inside PySpark 3.5.6 (the Deltalake connector calls
# .enableHiveSupport()). All replacement jars are SHA256-pinned to Maven Central.
#
#   zookeeper 3.6.3 -> 3.7.2         CVE-2023-44981 (SASL quorum auth bypass); ZK 3.7 runs on Java 8+
#   jackson-mapper/core-asl 1.9.13   CVE-2019-10202 (deserialization RCE) -- removed, no fix upstream
#   netty-codec-http 4.1.96 -> 4.1.135  CVE-2026-42581 / CVE-2026-42584 (HTTP request smuggling);
#                                    both fixed in 4.1.133.Final, so staying on the 4.1.x line keeps
#                                    binary compatibility with PySpark's sibling netty 4.1.96 jars.
#
# Derby (CVE-2022-46337) is deliberately left at the bundled 10.14.2.0. The only fixed
# release on Maven Central is 10.17.1.0, which requires Java 21 — these images ship Java 17
# (default-jre-headless), and the Java-8/11/17 backport jars (10.14.3.0 / 10.15.2.1 /
# 10.16.1.2) were never published upstream, so no drop-in Java-17 fix exists. The CVE is an
# LDAP-authenticator injection; OM's embedded Derby metastore uses no LDAP auth, so the
# vulnerable path is unreachable. Revisit if PySpark bumps Derby or the images move to Java 21.
#
# jetty-http (CVE-2026-2332) is shaded inside PySpark's hadoop-client-runtime / spark-core
# uber-jars, so it cannot be swapped as a standalone jar without repackaging Spark. Left as a
# documented residual.
#
# Skips cleanly when pyspark is genuinely absent (e.g. an INGESTION_DEPENDENCY build
# without the deltalake/pyspark deps). A pyspark that is installed but fails to import is
# treated as an error and fails the build, so a broken install can never ship unpatched
# jars silently.

set -euo pipefail

# Locate PySpark's bundled jars directory, distinguishing three cases via exit code:
#   0 -> installed and importable (prints the jars dir on stdout)
#   2 -> genuinely not installed (top-level pyspark module missing) -> skip
#   3 -> installed but import failed for any other reason -> fail the build
locate_pyspark_jars() {
  python - <<'PY'
import importlib.util, os, sys

# Distinguish "pyspark genuinely not installed" from "pyspark present but broken".
# find_spec only inspects the top-level pyspark package without importing it, so a
# missing pyspark.* submodule during a real import is never mistaken for absence.
try:
    spec = importlib.util.find_spec("pyspark")
except Exception as exc:
    sys.stderr.write(f"pyspark is installed but failed to import: {exc!r}\n")
    sys.exit(3)

if spec is None:
    sys.exit(2)

try:
    import pyspark
except Exception as exc:
    sys.stderr.write(f"pyspark is installed but failed to import: {exc!r}\n")
    sys.exit(3)

print(os.path.join(os.path.dirname(pyspark.__file__), "jars"))
PY
}

# Strip spacy's bundled CI test fixture. spacy/tests/package/requirements.txt pins an old
# black, which image scanners misreport as an installed package (CVE-2026-31900). The file
# is test-only and never imported at runtime. spaCy (from the pii-processor / sample-data
# extras) installs independently of pyspark (from deltalake), so this must run on every
# path — including builds that ship spaCy but not pyspark.
#
# Deterministic, not best-effort: locate spacy via find_spec (without importing it, so an
# installed-but-broken spacy is still found), delete the fixture, then assert it is gone.
# The image scanner reads the file on disk regardless of whether spacy imports, so a broken
# spacy must not let the fixture survive while the build succeeds.
strip_spacy_scanner_fixture() {
  local spacy_dir
  spacy_dir="$(python - <<'PY'
import importlib.util, os, sys
spec = importlib.util.find_spec("spacy")
if spec is None or not spec.submodule_search_locations:
    sys.exit(0)
print(spec.submodule_search_locations[0])
PY
)"
  if [ -z "${spacy_dir}" ] || [ ! -d "${spacy_dir}/tests" ]; then
    return 0
  fi
  find "${spacy_dir}/tests" -name 'requirements.txt' -delete
  local leftover
  leftover="$(find "${spacy_dir}/tests" -name 'requirements.txt')"
  if [ -n "${leftover}" ]; then
    echo "ERROR: spaCy scanner fixture still present after delete:" >&2
    echo "${leftover}" >&2
    exit 1
  fi
}

strip_spacy_scanner_fixture

JARS_DIR="$(locate_pyspark_jars)" && rc=0 || rc=$?

if [ "${rc}" -eq 2 ]; then
  echo "pyspark not installed; skipping PySpark jar patch"
  exit 0
elif [ "${rc}" -ne 0 ]; then
  echo "ERROR: pyspark is installed but not importable; refusing to ship unpatched jars" >&2
  exit 1
fi

if [ -z "${JARS_DIR}" ] || [ ! -d "${JARS_DIR}" ]; then
  echo "ERROR: pyspark imported but its jars dir '${JARS_DIR}' is missing" >&2
  exit 1
fi

fetch_jar() {
  wget -q "https://repo1.maven.org/maven2/$2" -O "$1"
  echo "$3  $1" | sha256sum -c -
}

cd "${JARS_DIR}"

rm -f zookeeper-*.jar zookeeper-jute-*.jar \
      jackson-mapper-asl-*.jar jackson-core-asl-*.jar \
      netty-codec-http-*.jar

fetch_jar zookeeper-3.7.2.jar \
  org/apache/zookeeper/zookeeper/3.7.2/zookeeper-3.7.2.jar \
  b12d6fb4afd7b3849d3a9a5a38b9260c23a12e1ea58ca8c8d775880249cb8eac

fetch_jar zookeeper-jute-3.7.2.jar \
  org/apache/zookeeper/zookeeper-jute/3.7.2/zookeeper-jute-3.7.2.jar \
  ad15d812b1f01f373638443adcda0e23fda549d65ced2be8c4f64bef33b5d774

fetch_jar netty-codec-http-4.1.135.Final.jar \
  io/netty/netty-codec-http/4.1.135.Final/netty-codec-http-4.1.135.Final.jar \
  4018529d3d6aecf4044b98c75d9a90c91839ddf49c7aa484c5ac81c90a15da02
