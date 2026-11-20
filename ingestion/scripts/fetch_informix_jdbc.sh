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

# Pre-fetch the IBM Informix JDBC driver into the image.
#
# Without this, sqlalchemy-jdbcapi fetches the jars from Maven Central on the
# first Informix connection. In an air-gapped or egress-filtered deployment that
# fails at connection time with a Maven URL error -- which points at neither
# Informix nor the network policy, and is reached only once a user has already
# configured a service and pressed Test Connection.
#
# Fetching at build time also lets us verify a checksum. The library downloads
# over HTTPS but does not check what it got.
#
# The versions here MUST match the constants in
# ingestion/src/metadata/ingestion/source/database/informix/dialect.py: the jar
# *filename* is the whole of sqlalchemy-jdbcapi's cache-hit test, so a version
# bump on one side alone silently reinstates the runtime download rather than
# failing. tests/unit/topology/database/test_informix_dialect.py asserts the two
# stay in step.

set -euo pipefail

TARGET_DIR="${1:-/opt/jdbc-drivers}"
MAVEN_BASE="${MAVEN_BASE:-https://repo1.maven.org/maven2}"

INFORMIX_JDBC_VERSION="15.0.0.1.1"
BSON_VERSION="4.11.1"

INFORMIX_JDBC_SHA256="b544e61c9d37ac667038d2b7f2c06b2337dbb4d3a0fc8d1e66916ace9da467b0"
BSON_SHA256="d6590dbb96826812f9d1eb4a8f309f2bfb58f99ea773807e35cb92d50b7e2d30"

mkdir -p "${TARGET_DIR}"

# Verify before the jar takes its final name. sqlalchemy-jdbcapi treats the
# presence of the filename as proof the cache is warm, so a jar that failed
# verification must not be left sitting at that path.
fetch_jar() {
  local url="$1" name="$2" sha256="$3"
  local tmp="${TARGET_DIR}/${name}.tmp"
  echo "Fetching ${name}"
  curl -fsSL "${url}" -o "${tmp}"
  if ! echo "${sha256}  ${tmp}" | sha256sum -c - >/dev/null; then
    rm -f "${tmp}"
    echo "ERROR: checksum mismatch for ${name} from ${url}" >&2
    exit 1
  fi
  mv "${tmp}" "${TARGET_DIR}/${name}"
}

fetch_jar \
  "${MAVEN_BASE}/com/ibm/informix/jdbc/${INFORMIX_JDBC_VERSION}/jdbc-${INFORMIX_JDBC_VERSION}.jar" \
  "jdbc-${INFORMIX_JDBC_VERSION}.jar" \
  "${INFORMIX_JDBC_SHA256}"

fetch_jar \
  "${MAVEN_BASE}/org/mongodb/bson/${BSON_VERSION}/bson-${BSON_VERSION}.jar" \
  "bson-${BSON_VERSION}.jar" \
  "${BSON_SHA256}"
