#!/usr/bin/env bash
# Copyright 2026 Collate. Licensed under the Apache License, Version 2.0.
# Measures the translator/storage path; use rdf-reindex-benchmark.sh for the full app.
# Point this at an isolated, preconfigured dataset. It appends synthetic entities.
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
"${JAVA_BIN:-java}" -cp "$benchmark_classpath" \
  "-Dstreaming=${STREAMING:-true}" "-Dgzip=${GZIP:-false}" \
  "-DappendBatch=${APPEND_BATCH:-1000}" "-DsubmissionBatch=${SUBMISSION_BATCH:-100}" \
  "-DwriteMode=${WRITE_MODE:-insert}" \
  org.openmetadata.service.rdf.RdfWritePathScaleHarness \
  "${FUSEKI_ENDPOINT:-http://localhost:3030/openmetadata}" \
  "${ENTITIES:-20000}" "${WIDE_EVERY:-100}" "${WIDE_COLUMNS:-500}"
