#!/bin/bash
# amana.sh — create test data for SQL deduplication in lineage search indexing
#
# Simulates the BATCH_RUN VIEW scenario:
#   N upstream source tables → 1 downstream view, every edge carries the same large SQL.
#
# Usage:
#   ./amana.sh          # 20 upstream tables (quick smoke test)
#   ./amana.sh 660      # full reproduction of the 20 MB payload overflow
#
# After running, trigger a reindex and use the verify commands printed at the end.

TOKEN="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
BASE="http://localhost:8585/api/v1"
UPSTREAM_COUNT=${1:-20}

# Curl wrappers — no -f, we inspect HTTP status ourselves
api_post() { curl -s -X POST "$BASE/$1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2"; }
api_put_status() { curl -s -X PUT "$BASE/$1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2" -o /dev/null -w "%{http_code}"; }
api_get() { curl -s "$BASE/$1" -H "Authorization: Bearer $TOKEN"; }

# POST an entity; if it already exists (409), GET it by FQN instead. Returns the id.
ensure_id() {
  local endpoint="$1" body="$2" fqn_endpoint="$3"
  local id
  id=$(api_post "$endpoint" "$body" | jq -r '.id // empty' 2>/dev/null)
  if [ -z "$id" ]; then
    id=$(api_get "$fqn_endpoint" | jq -r '.id // empty' 2>/dev/null)
  fi
  printf '%s' "$id"
}

# Build the large SQL — 200 UNION ALL branches ≈ 14 KB per edge.
# 660 edges × 14 KB = ~9 MB raw; with dedup → ~14 KB stored once.
UNION_PARTS=""
for i in $(seq 1 200); do
  UNION_PARTS="${UNION_PARTS}SELECT id, amount, row_status, created_at FROM source_batch_${i}"
  [ "$i" -lt 200 ] && UNION_PARTS="${UNION_PARTS} UNION ALL "
done
LARGE_SQL="CREATE OR REPLACE VIEW batch_analytics_view AS ${UNION_PARTS}"

echo "=== Infrastructure ==="

SVC_ID=$(ensure_id \
  "services/databaseServices" \
  '{"name":"amana_db_svc","serviceType":"Postgres","connection":{"config":{"type":"Postgres","username":"test","authType":{"password":"test"},"hostPort":"localhost:5432","database":"amana"}}}' \
  "services/databaseServices/name/amana_db_svc")
echo "service  id=$SVC_ID"

DB_ID=$(ensure_id \
  "databases" \
  '{"name":"amana_db","service":"amana_db_svc"}' \
  "databases/name/amana_db_svc.amana_db")
echo "database id=$DB_ID"

SCH_ID=$(ensure_id \
  "databaseSchemas" \
  '{"name":"amana_schema","database":"amana_db_svc.amana_db"}' \
  "databaseSchemas/name/amana_db_svc.amana_db.amana_schema")
echo "schema   id=$SCH_ID"

echo ""
echo "=== Downstream VIEW table ==="
VIEW_BODY=$(jq -n '{
  name: "batch_analytics_view",
  databaseSchema: "amana_db_svc.amana_db.amana_schema",
  tableType: "View",
  columns: [
    {name:"id",         dataType:"BIGINT"},
    {name:"amount",     dataType:"DECIMAL"},
    {name:"row_status", dataType:"VARCHAR", dataLength:64},
    {name:"created_at", dataType:"TIMESTAMP"}
  ]
}')
VIEW_ID=$(ensure_id "tables" "$VIEW_BODY" \
  "tables/name/amana_db_svc.amana_db.amana_schema.batch_analytics_view")
echo "view     id=$VIEW_ID"

if [ -z "$VIEW_ID" ]; then
  echo "ERROR: could not create or find batch_analytics_view"
  exit 1
fi

echo ""
echo "=== Creating $UPSTREAM_COUNT upstream tables + lineage edges ==="
printf "    SQL size per edge : %d bytes\n" "${#LARGE_SQL}"
printf "    Raw payload       : ~%d KB  (before dedup)\n" $(( UPSTREAM_COUNT * ${#LARGE_SQL} / 1024 ))

CREATED=0
FAILED=0

for i in $(seq 1 "$UPSTREAM_COUNT"); do
  TABLE_BODY=$(jq -n --argjson i "$i" '{
    name: ("source_batch_" + ($i | tostring)),
    databaseSchema: "amana_db_svc.amana_db.amana_schema",
    columns: [
      {name:"id",         dataType:"BIGINT"},
      {name:"amount",     dataType:"DECIMAL"},
      {name:"row_status", dataType:"VARCHAR", dataLength:64},
      {name:"created_at", dataType:"TIMESTAMP"}
    ]
  }')
  SRC_FQN="amana_db_svc.amana_db.amana_schema.source_batch_${i}"
  SRC_ID=$(ensure_id "tables" "$TABLE_BODY" "tables/name/${SRC_FQN}")

  if [ -z "$SRC_ID" ]; then
    echo ""
    echo "  [FAIL] could not create or find source_batch_$i"
    FAILED=$((FAILED + 1))
    continue
  fi

  LINEAGE_BODY=$(jq -n --arg from "$SRC_ID" --arg to "$VIEW_ID" --arg sql "$LARGE_SQL" '{
    edge: {
      fromEntity: {id: $from, type: "table"},
      toEntity:   {id: $to,   type: "table"},
      lineageDetails: {source: "Manual", sqlQuery: $sql}
    }
  }')
  STATUS=$(api_put_status "lineage" "$LINEAGE_BODY")

  if [ "$STATUS" = "200" ]; then
    CREATED=$((CREATED + 1))
    printf "  [OK] %3d/%d  source_batch_%d\r" "$CREATED" "$UPSTREAM_COUNT" "$i"
  else
    echo ""
    echo "  [FAIL] lineage source_batch_$i (HTTP $STATUS)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo ""
echo "=== Summary ==="
printf "  Edges created : %d / %d\n" "$CREATED" "$UPSTREAM_COUNT"
printf "  Failed        : %d\n" "$FAILED"
printf "  SQL per edge  : %d bytes\n" "${#LARGE_SQL}"
printf "  Raw payload   : ~%d KB  (all edges, no dedup)\n" $(( CREATED * ${#LARGE_SQL} / 1024 ))
printf "  After dedup   : ~%d KB  (SQL stored once)\n" $(( ${#LARGE_SQL} / 1024 ))

echo ""
echo "=== Trigger reindex ==="
REINDEX=$(curl -s -X PUT "$BASE/search/reindex" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recreateIndex":false}')
echo "$REINDEX" | jq '{jobId: .id, status: .status}' 2>/dev/null \
  || echo "  Trigger manually: Admin → Search Settings → Re-Index"

echo ""
echo "=== Verify (after reindex completes) ==="
cat <<EOF

  # lineageSqlQueries should have 1 entry; upstreamLineage should have $CREATED edges
  curl -s '$BASE/search/query?q=batch_analytics_view&index=table_search_index' \\
    -H 'Authorization: Bearer $TOKEN' \\
    | jq '.hits.hits[0]._source | {lineageSqlQueries_count: (.lineageSqlQueries | length), edge_count: (.upstreamLineage | length)}'

  # Each edge should have sqlQueryKey set and sqlQuery null
  curl -s '$BASE/search/query?q=batch_analytics_view&index=table_search_index' \\
    -H 'Authorization: Bearer $TOKEN' \\
    | jq '.hits.hits[0]._source.upstreamLineage[0] | {sqlQueryKey, sqlQuery}'

EOF
