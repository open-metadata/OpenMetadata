#!/usr/bin/env bash
# Copyright 2026 Collate. Licensed under the Apache License, Version 2.0.
# Creates isolated test containers; measures full catalog rebuilds and serving queries.
set -euo pipefail

rdf_scale_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$rdf_scale_root"
rdf_scale_output="${RDF_SCALE_OUTPUT:-$rdf_scale_root/.context/rdf-catalog-scale}"
rdf_scale_classpath_file="${RDF_SCALE_CLASSPATH_FILE:-$rdf_scale_root/.context/rdf-catalog-scale-classpath.txt}"
mkdir -p "$rdf_scale_output" "$(dirname "$rdf_scale_classpath_file")"
if [[ -e "$rdf_scale_output/run.log" ]]; then
  printf 'Choose a new RDF_SCALE_OUTPUT directory; %s already contains a run.\n' "$rdf_scale_output" >&2
  exit 1
fi

if [[ "${BUILD:-true}" == true ]]; then
  mvn -B -pl openmetadata-integration-tests -am install -DskipTests -DskipITs
  mvn -B -pl openmetadata-integration-tests dependency:build-classpath \
    "-Dmdep.outputFile=$rdf_scale_classpath_file" -DincludeScope=test
fi

rdf_scale_classpath="openmetadata-integration-tests/target/test-classes:$(cat "$rdf_scale_classpath_file")"
rdf_scale_image="${RDF_SCALE_FUSEKI_IMAGE:-rdf-catalog-scale:fuseki}"
rdf_scale_java="${JAVA_BIN:-java}"
if [[ -z "${JAVA_BIN:-}" && -n "${JAVA_HOME:-}" ]]; then
  rdf_scale_java="$JAVA_HOME/bin/java"
fi
if [[ "${BUILD_IMAGE:-true}" == true ]]; then
  docker build -t "$rdf_scale_image" docker/rdf-store
fi

"$rdf_scale_java" -Xms1g "-Xmx${RDF_SCALE_APP_HEAP:-8g}" \
  -DenableRdf=true -DrdfCatalogScale=true \
  "-DrdfScaleTables=${RDF_SCALE_TABLES:-200000}" \
  "-DrdfScaleEdges=${RDF_SCALE_EDGES:-2000000}" \
  "-DrdfScaleWideEvery=${RDF_SCALE_WIDE_EVERY:-100}" \
  "-DrdfScaleWideColumns=${RDF_SCALE_WIDE_COLUMNS:-500}" \
  "-DrdfScaleDetailedEvery=${RDF_SCALE_DETAILED_EVERY:-100}" \
  "-DrdfScaleQuerySamples=${RDF_SCALE_QUERY_SAMPLES:-100}" \
  "-DrdfScaleDiagnostics=${RDF_SCALE_DIAGNOSTICS:-false}" \
  "-DrdfScalePartitionSize=${RDF_SCALE_PARTITION_SIZE:-10000}" \
  "-DrdfScaleProducerThreads=${RDF_SCALE_PRODUCER_THREADS:-2}" \
  "-DrdfScaleOutput=$rdf_scale_output" \
  "-DrdfScaleCommit=$(git rev-parse HEAD)" \
  "-DrdfContainerImage=$rdf_scale_image" -DrdfContainerTmpfs=false -DrdfContainerStablePort=true \
  "-DrdfContainerHostPort=${RDF_SCALE_FUSEKI_PORT:-43030}" \
  "-DrdfContainerJvmArgs=-Xms${RDF_SCALE_FUSEKI_HEAP:-4g} -Xmx${RDF_SCALE_FUSEKI_HEAP:-4g}" \
  "-DrdfContainerMemoryBytes=${RDF_SCALE_FUSEKI_MEMORY_BYTES:-17179869184}" \
  "-DrdfContainerNanoCpus=${RDF_SCALE_FUSEKI_NANO_CPUS:-6000000000}" \
  -DdatabaseType=postgres -DdatabaseImage=postgres:15 -DdbDurable=true -DdbContainerTmpfs=false \
  -DdbContainerMemoryBytes=8589934592 -DdbContainerNanoCpus=2000000000 \
  -DsearchType=elasticsearch -Djunit.jupiter.execution.parallel.enabled=false \
  -cp "$rdf_scale_classpath" org.openmetadata.it.tests.RdfCatalogScaleIT \
  2>&1 | tee "$rdf_scale_output/run.log"
