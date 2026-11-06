#!/usr/bin/env bash
# Copyright 2026 Collate. Licensed under the Apache License, Version 2.0.
# Compares what live updates of wide tables (wide in custom properties: 2.0 does not project
# columns) cost Fuseki when each write replaces the projection
# whole (every write before ADR:2026-11-03-live-rdf-entity-writes-send-only-the-changed-triples)
# and when it sends only the difference: volume growth, update requests, payload and outcomes.
# Point it at an idle openmetadata/fuseki dataset: it clears the knowledge graph and compacts.
# DISK_USAGE_COMMAND prints the dataset directory's size in KB; the default reads it from the
# FUSEKI_CONTAINER container.
set -euo pipefail

benchmark_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$benchmark_root"
benchmark_classpath_file="${RDF_BENCH_CLASSPATH_FILE:-$benchmark_root/.context/rdf-write-benchmark-classpath.txt}"
mkdir -p "$(dirname "$benchmark_classpath_file")"
if [[ ! -f "$benchmark_classpath_file" || "${BUILD:-true}" == true ]]; then
  mvn -B -pl openmetadata-service -am install -DskipTests -DskipITs
  mvn -B -pl openmetadata-service dependency:build-classpath "-Dmdep.outputFile=$benchmark_classpath_file"
fi
benchmark_classpath="openmetadata-service/target/test-classes:openmetadata-service/target/classes:openmetadata-spec/target/classes:common/target/classes:$(cat "$benchmark_classpath_file")"
for strategy in ${STRATEGIES:-REPLACE DIFFERENCE}; do
  "${JAVA_BIN:-java}" -cp "$benchmark_classpath" \
    "-Dusername=${FUSEKI_USERNAME:-admin}" "-Dpassword=${FUSEKI_PASSWORD:-admin}" \
    "-DdiskUsageCommand=${DISK_USAGE_COMMAND:-docker exec ${FUSEKI_CONTAINER:-om-fuseki-bench} du -sk /fuseki/databases/${FUSEKI_DATASET:-openmetadata}}" \
    org.openmetadata.service.rdf.storage.RdfLiveUpdateDiskHarness \
    "${FUSEKI_ENDPOINT:-http://localhost:3030/openmetadata}" \
    "$strategy" "${TABLES:-200}" "${PROPERTIES:-300}" "${ROUNDS:-5}"
done
