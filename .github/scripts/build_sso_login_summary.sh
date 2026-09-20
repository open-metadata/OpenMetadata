#!/usr/bin/env bash
# Builds a fixed-width per-provider summary of the SSO Login Nightly matrix
# from the outcome artifacts uploaded by each matrix leg
# (`sso-login-outcome-<provider>`, containing `status.txt` and optionally
# `results.json`).
#
# Consumed by both the Slack notifier (`notify-slack`) and the PR-comment
# notifier (`notify-pr`) in `.github/workflows/playwright-sso-login-nightly.yml`
# so the two surfaces render identical tables.
#
# Input: $OUTCOMES_DIR (default `outcomes`) — the directory
#   `actions/download-artifact` wrote the pattern download to.
# Output: writes three files under $1 (default `/tmp/sso-summary`):
#   table.txt   header + divider + one row per provider (no code fences)
#   totals.txt  one-line totals string
#   status.txt  passed | failed | skipped  (overall verdict for the run)
#
# Table status column is plain ASCII (`pass`, `flaky`, `skipped`, `FAIL`,
# `SETUP-FAIL`, `NO-REPORT`, `unknown`) — uppercase for failures so they read
# louder inside a monospace code block. Emoji short codes would misalign the
# columns because raw source width ≠ rendered glyph width; the overall
# verdict (status.txt) drives the header emoji in each notifier instead.

set -euo pipefail

OUT_DIR="${1:-/tmp/sso-summary}"
IN_DIR="${OUTCOMES_DIR:-outcomes}"
mkdir -p "$OUT_DIR"

# Must match the matrix order in the workflow so the table reads top-to-bottom
# the same as the workflow definition. Kept in sync manually — a mismatch just
# reorders rows, it doesn't lose data.
providers=(
  basic
  ldap
  keycloak-oidc-confidential
  keycloak-oidc-public
  msal-mock
  auth0-mock
  okta
  keycloak-azure-saml
  keycloak-azure-saml-crosssite
)

# One shared printf mask so header, divider, and rows stay aligned. Column
# widths are tuned for the longest provider name (30) and the 4-digit numeric
# columns.
fmt='%-30s  %-11s  %5s  %5s  %5s  %5s  %10s\n'

fmt_duration() {
  local ms="$1"
  if [ -z "$ms" ] || [ "$ms" = "null" ] || [ "$ms" = "0" ]; then
    printf -- '-'
    return
  fi
  local total_sec=$(( ms / 1000 ))
  local m=$(( total_sec / 60 ))
  local s=$(( total_sec % 60 ))
  printf '%dm %02ds' "$m" "$s"
}

{
  # shellcheck disable=SC2059  # $fmt is our intended format string
  printf "$fmt" 'Provider' 'Status' 'Pass' 'Fail' 'Flaky' 'Skip' 'Duration'
  # shellcheck disable=SC2059
  printf "$fmt" '------------------------------' '-----------' '-----' '-----' '-----' '-----' '----------'
} > "$OUT_DIR/table.txt"

tot_pass=0; tot_fail=0; tot_flaky=0; tot_skip=0; tot_dur_ms=0
any_failed=false; any_ran=false

for p in "${providers[@]}"; do
  dir="${IN_DIR}/sso-login-outcome-${p}"
  status_file="${dir}/status.txt"
  results_file="${dir}/results.json"

  if [ ! -f "$status_file" ]; then
    # Outcome artifact missing — leg was cancelled or the runner never
    # completed the "Record leg outcome" step. Report as unknown rather
    # than silently dropping the row.
    # shellcheck disable=SC2059
    printf "$fmt" "$p" 'UNKNOWN' '-' '-' '-' '-' '-' >> "$OUT_DIR/table.txt"
    continue
  fi

  status=$(cat "$status_file")
  case "$status" in
    skipped)
      # shellcheck disable=SC2059
      printf "$fmt" "$p" 'skipped' '-' '-' '-' '-' '-' >> "$OUT_DIR/table.txt"
      ;;
    setup-failed)
      any_failed=true
      # shellcheck disable=SC2059
      printf "$fmt" "$p" 'SETUP-FAIL' '-' '-' '-' '-' '-' >> "$OUT_DIR/table.txt"
      ;;
    completed)
      any_ran=true
      if [ ! -f "$results_file" ]; then
        any_failed=true
        # shellcheck disable=SC2059
        printf "$fmt" "$p" 'NO-REPORT' '-' '-' '-' '-' '-' >> "$OUT_DIR/table.txt"
      else
        pass=$(jq -r '.stats.expected   // 0' "$results_file")
        fail=$(jq -r '.stats.unexpected // 0' "$results_file")
        flaky=$(jq -r '.stats.flaky     // 0' "$results_file")
        skip=$(jq -r '.stats.skipped    // 0' "$results_file")
        dur=$(jq -r '.stats.duration    // 0' "$results_file")
        tot_pass=$(( tot_pass + pass ))
        tot_fail=$(( tot_fail + fail ))
        tot_flaky=$(( tot_flaky + flaky ))
        tot_skip=$(( tot_skip + skip ))
        dur_int=$(printf '%.0f' "$dur")
        tot_dur_ms=$(( tot_dur_ms + dur_int ))
        if [ "$fail" -gt 0 ]; then
          any_failed=true
          label='FAIL'
        elif [ "$flaky" -gt 0 ]; then
          label='flaky'
        else
          label='pass'
        fi
        # shellcheck disable=SC2059
        printf "$fmt" "$p" "$label" "$pass" "$fail" "$flaky" "$skip" "$(fmt_duration "$dur_int")" >> "$OUT_DIR/table.txt"
      fi
      ;;
    *)
      # shellcheck disable=SC2059
      printf "$fmt" "$p" 'UNKNOWN' '-' '-' '-' '-' '-' >> "$OUT_DIR/table.txt"
      ;;
  esac
done

if $any_failed; then
  echo 'failed' > "$OUT_DIR/status.txt"
elif $any_ran; then
  echo 'passed' > "$OUT_DIR/status.txt"
else
  echo 'skipped' > "$OUT_DIR/status.txt"
fi

printf 'Totals: %d passed · %d failed · %d flaky · %d skipped · duration %s\n' \
  "$tot_pass" "$tot_fail" "$tot_flaky" "$tot_skip" "$(fmt_duration "$tot_dur_ms")" \
  > "$OUT_DIR/totals.txt"
