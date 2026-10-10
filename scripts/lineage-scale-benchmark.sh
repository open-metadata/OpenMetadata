#!/usr/bin/env bash
# Copyright 2026 Collate. Licensed under the Apache License, Version 2.0.
#
# Runs the lineage scene benchmark at a size the scheduled nightly cannot afford, and publishes
# the result in the same shape as docs/artifacts/rdf-scale/.
#
# The nightly's scale-it job runs LineageScenePerformanceScaleIT at its 50k default, which is
# roughly 25 minutes of seeding. Issue #32050's 2M-asset target is hours of seeding through the
# REST API — there is no bulk lineage endpoint, so every edge is one PUT — so it runs from here,
# on demand, against a long-lived cluster.
#
#   export OM_URL=https://om.example.com OM_ADMIN_TOKEN=...
#   LINEAGE_TABLES=2000000 LINEAGE_EDGES=2000000 ./scripts/lineage-scale-benchmark.sh
#
# Knobs (all optional; defaults match the IT's own):
#   LINEAGE_TABLES, LINEAGE_EDGES, LINEAGE_SERVICES, LINEAGE_DATABASES_PER_SERVICE,
#   LINEAGE_SCHEMAS_PER_DATABASE, LINEAGE_DEPTH, LINEAGE_HUB_COUNT, LINEAGE_HUB_FANOUT,
#   LINEAGE_SAMPLES, LINEAGE_WARMUPS, LINEAGE_WORKERS, LINEAGE_LABEL, LINEAGE_OUTPUT,
#   SKIP_CLEANUP (default true here — a multi-hour corpus is worth keeping), BUILD (default true),
#   LINEAGE_SEED_MANIFEST — benchmark a graph scripts/lineage_seed already created (its
#   manifest.json) instead of seeding one; the LINEAGE_* sizes are then ignored, and the label and
#   the published workload describe that graph
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ -z "${OM_URL:-}" || -z "${OM_ADMIN_TOKEN:-}" ]]; then
  printf 'Set OM_URL and OM_ADMIN_TOKEN — this benchmark runs against an external cluster.\n' >&2
  exit 1
fi

lineage_tables="${LINEAGE_TABLES:-50000}"
lineage_edges="${LINEAGE_EDGES:-50000}"
default_label="${lineage_tables}-assets"
seed_manifest="${LINEAGE_SEED_MANIFEST:-}"
seeded_workload=""
if [[ -n "$seed_manifest" ]]; then
  if [[ ! -f "$seed_manifest" ]]; then
    printf 'LINEAGE_SEED_MANIFEST %s does not exist.\n' "$seed_manifest" >&2
    exit 1
  fi
  seeded_workload="$(python3 -c '
import json, sys
graph = json.load(open(sys.argv[1]))["benchmark"]
keys = ("cohortFqnPrefix", "services", "databases", "schemas", "tables", "edges", "columnEdges")
workload = {"graphSource": "seed-manifest", **{key: graph[key] for key in keys}}
print(json.dumps(workload, indent=2).replace("\n", "\n  "))
' "$seed_manifest")"
  lineage_tables="$(python3 -c 'import json, sys; print(json.loads(sys.argv[1])["tables"])' "$seeded_workload")"
  default_label="seeded-${lineage_tables}-tables"
fi
lineage_label="${LINEAGE_LABEL:-$default_label}"
lineage_output="${LINEAGE_OUTPUT:-$repo_root/docs/artifacts/lineage-scale/$(date -u +%Y-%m-%d)-${lineage_label}}"

if [[ -e "$lineage_output" ]]; then
  printf 'Choose a new LINEAGE_OUTPUT; %s already holds a run.\n' "$lineage_output" >&2
  exit 1
fi
mkdir -p "$lineage_output"

if [[ "${BUILD:-true}" == true ]]; then
  mvn -B -DskipTests install -pl :openmetadata-integration-tests -am
fi

benchmark_dir="$repo_root/openmetadata-integration-tests/target/benchmark"
rm -rf "$benchmark_dir"

set +e
mvn -B verify -P scale-it -pl :openmetadata-integration-tests \
  -Dskip.embedded.bootstrap=true \
  -Dit.test=LineageScenePerformanceScaleIT \
  -Dfailsafe.failIfNoSpecifiedTests=false \
  -Djpw.lineage.tables="$lineage_tables" \
  -Djpw.lineage.edges="$lineage_edges" \
  -Djpw.lineage.services="${LINEAGE_SERVICES:-20}" \
  -Djpw.lineage.databasesPerService="${LINEAGE_DATABASES_PER_SERVICE:-5}" \
  -Djpw.lineage.schemasPerDatabase="${LINEAGE_SCHEMAS_PER_DATABASE:-5}" \
  -Djpw.lineage.depth="${LINEAGE_DEPTH:-8}" \
  -Djpw.lineage.hubCount="${LINEAGE_HUB_COUNT:-10}" \
  -Djpw.lineage.hubFanout="${LINEAGE_HUB_FANOUT:-500}" \
  -Djpw.lineage.samples="${LINEAGE_SAMPLES:-20}" \
  -Djpw.lineage.warmups="${LINEAGE_WARMUPS:-5}" \
  -Djpw.lineage.workers="${LINEAGE_WORKERS:-32}" \
  -Djpw.lineage.skipCleanup="${SKIP_CLEANUP:-true}" \
  -Djpw.lineage.seedManifest="${LINEAGE_SEED_MANIFEST:-}" \
  -Djpw.bench.gitSha="$(git rev-parse HEAD)" \
  2>&1 | tee "$lineage_output/run.log"
maven_status="${PIPESTATUS[0]}"
set -e

# The report is published whether or not a budget assertion failed — a run that breached its
# budget is precisely the run whose numbers someone needs to read.
if [[ -d "$benchmark_dir" ]]; then
  cp "$benchmark_dir"/*.json "$lineage_output/" 2>/dev/null || true
fi

published_files=""
for published in "$lineage_output"/*.json; do
  [[ -e "$published" ]] || continue
  name="$(basename "$published")"
  [[ "$name" == "manifest.json" ]] && continue
  published_files+="${published_files:+, }\"$name\""
done

outcome=$([[ "$maven_status" -eq 0 ]] && echo passed || echo failed)
workload="$seeded_workload"
if [[ -z "$workload" ]]; then
  workload="$(cat <<JSON
{
    "graphSource": "loader",
    "tables": $lineage_tables,
    "edges": $lineage_edges,
    "services": ${LINEAGE_SERVICES:-20},
    "databasesPerService": ${LINEAGE_DATABASES_PER_SERVICE:-5},
    "schemasPerDatabase": ${LINEAGE_SCHEMAS_PER_DATABASE:-5},
    "depth": ${LINEAGE_DEPTH:-8},
    "hubCount": ${LINEAGE_HUB_COUNT:-10},
    "hubFanout": ${LINEAGE_HUB_FANOUT:-500}
  }
JSON
)"
fi
cat > "$lineage_output/manifest.json" <<JSON
{
  "productionCommit": "$(git rev-parse HEAD)",
  "outcome": "$outcome",
  "omUrl": "$OM_URL",
  "workload": $workload,
  "files": [$published_files]
}
JSON

printf 'Lineage scale benchmark %s. Published to %s\n' "$outcome" "$lineage_output"
exit "$maven_status"
