#!/usr/bin/env bash
# Reproduces GitHub issue open-metadata/openmetadata-collate#3851:
#
#   When the explore search bar fires its two requests for the same query —
#     a) GET /api/v1/search/query?q=...&index=dataAsset&size=0     (entity-type aggregation)
#     b) GET /api/v1/search/query?q=...&index=tableColumn&size=N   (column hits)
#   — the count for `tableColumn` reported by (a) does not match the total reported by (b).
#
# Root cause:
#   `index=tableColumn` routes through `buildColumnSearchBuilderV2` (a lenient multi_match).
#   `index=dataAsset`  routes through `buildDataAssetSearchBuilderV2` with the composite asset
#   config, which applies stricter phrase / 2<70% matching to column docs. The two query shapes
#   produce different result sets even though both indexes contain the same column documents.
#
# Related secondary bug (the "_ issue"):
#   The `om_analyzer` splits identifiers like `first_name` on letter/digit/underscore boundaries
#   into ["first","name"]. With `Operator.Or` + `min_should_match=0` (the lenient column builder),
#   any column whose name contains ONLY "first" or ONLY "name" is also returned, drowning out the
#   actual relevant matches.
#
# This script does NOT create test assets — it probes the running catalog with a fixed list of
# queries that are known to expose the divergence on the bundled sample data, prints the counts
# side-by-side, and exits non-zero if any query shows a mismatch. Asset-based isolation lives
# in the regression test (ColumnSearchIndexIT).
#
# Usage:
#   OM_HOST=http://localhost:8585 OM_TOKEN=<jwt> ./reproduce_column_agg_mismatch.sh [extra-query]

set -euo pipefail

HOST="${OM_HOST:-http://localhost:8585}"
TOKEN="${OM_TOKEN:-eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg}"

QUERIES=(
  "first_name"
  "last_name"
  "first name"
  "shipping address"
  "first name address"
)
[ "${1:-}" ] && QUERIES+=("$1")

AUTH=(-H "Authorization: Bearer $TOKEN")

probe() {
  local q="$1"
  local enc agg_file col_file
  enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$q")
  agg_file=$(mktemp)
  col_file=$(mktemp)
  if ! curl -sf "${AUTH[@]}" \
    "$HOST/api/v1/search/query?q=$enc&index=dataAsset&from=0&size=0&deleted=false&track_total_hits=true&fetch_source=false" \
    -o "$agg_file" \
    || ! curl -sf "${AUTH[@]}" \
    "$HOST/api/v1/search/query?q=$enc&index=tableColumn&from=0&size=0&deleted=false&track_total_hits=true&fetch_source=false" \
    -o "$col_file"; then
    echo "  [ERR ] q=\"$q\" — search API call failed; is OM running at $HOST?"
    rm -f "$agg_file" "$col_file"
    return 2
  fi
  python3 - "$q" "$agg_file" "$col_file" <<'PY'
import json, sys
q, agg_path, col_path = sys.argv[1], sys.argv[2], sys.argv[3]
with open(agg_path) as f: agg = json.load(f)
with open(col_path) as f: col = json.load(f)
agg_total = agg.get('hits', {}).get('total', {}).get('value', '?')
col_total = col.get('hits', {}).get('total', {}).get('value', '?')
buckets = agg.get('aggregations', {}).get('sterms#entityType', {}).get('buckets', [])
agg_tc = next((b.get('doc_count', 0) for b in buckets if b.get('key') == 'tableColumn'), 0)
status = "OK  " if agg_tc == col_total else "DIFF"
print(f"  [{status}] q={q!r:<26} dataAsset.total={agg_total:<6} agg.tableColumnBucket={agg_tc:<6} tableColumn.total={col_total}")
sys.exit(0 if agg_tc == col_total else 2)
PY
  local rc=$?
  rm -f "$agg_file" "$col_file"
  return $rc
}

echo "Host : $HOST"
if ! curl -sf -o /dev/null "${AUTH[@]}" "$HOST/api/v1/system/version"; then
  echo "ERROR: $HOST is not reachable (or auth is wrong). Start OM and retry."
  exit 4
fi
echo "Probing ${#QUERIES[@]} queries; OK = bucket count matches index=tableColumn total."
echo "------------------------------------------------------------------"
fail=0
for q in "${QUERIES[@]}"; do
  probe "$q" || fail=1
done
echo "------------------------------------------------------------------"

ENC0=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "${QUERIES[0]}")
echo
echo "UI verification:"
echo "  1. Open $HOST/explore/tableColumn?search=$ENC0"
echo "  2. Note the count badge on the tableColumn tab vs the entity-type aggregation panel."
echo "     Before the fix they diverge; after the fix they should match."

exit "$fail"
