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
# Skips cleanly when pyspark is absent (e.g. an INGESTION_DEPENDENCY build without the
# deltalake/pyspark deps); only patches jars when the pyspark jars dir exists.

set -euo pipefail

JARS_DIR="$(python -c 'import os,pyspark;print(os.path.join(os.path.dirname(pyspark.__file__),"jars"))' 2>/dev/null || true)"

if [ -z "${JARS_DIR}" ] || [ ! -d "${JARS_DIR}" ]; then
  echo "pyspark not installed; skipping PySpark jar patch"
  exit 0
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
