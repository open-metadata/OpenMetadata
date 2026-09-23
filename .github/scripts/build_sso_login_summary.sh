#!/usr/bin/env bash
# Shared summary for SSO Login Nightly's Slack + PR-comment notifiers.
#
# Input:  $OUTCOMES_DIR (default `outcomes`) — where download-artifact
#         wrote the `sso-login-outcome-*` pattern download.
# Output: four files under $1 (default `/tmp/sso-summary`):
#         table.txt   fixed-width monospace, for the Slack code block
#                     (Slack has no native table syntax; alignment relies
#                     on the whole message being rendered in monospace)
#         table.md    real Markdown table, for the GitHub PR comment
#                     (GitHub renders it as an HTML table with borders)
#         totals.txt  one-liner totals string
#         status.txt  overall verdict: passed | failed | skipped
#
# table.txt uses plain ASCII (uppercase for failures) rather than emoji
# short codes because raw source width ≠ rendered glyph width — the columns
# would misalign inside the monospace code block. table.md uses emoji
# short codes (GitHub renders them) since HTML-table cells don't care about
# source width.

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

# Emit one row into both surfaces at once. Keeps table.txt and table.md
# strictly in sync so a future edit can't drift one and not the other.
# Args: provider, txt_status, md_status, pass, fail, flaky, skip, duration
emit_row() {
  local provider="$1" txt_status="$2" md_status="$3"
  local pass="$4" fail="$5" flaky="$6" skip="$7" duration="$8"
  # shellcheck disable=SC2059  # $fmt is our intended format string
  printf "$fmt" "$provider" "$txt_status" "$pass" "$fail" "$flaky" "$skip" "$duration" \
    >> "$OUT_DIR/table.txt"
  printf '| %s | %s | %s | %s | %s | %s | %s |\n' \
    "$provider" "$md_status" "$pass" "$fail" "$flaky" "$skip" "$duration" \
    >> "$OUT_DIR/table.md"
}

# Headers + dividers for both surfaces.
{
  # shellcheck disable=SC2059
  printf "$fmt" 'Provider' 'Status' 'Pass' 'Fail' 'Flaky' 'Skip' 'Duration'
  # shellcheck disable=SC2059
  printf "$fmt" '------------------------------' '-----------' '-----' '-----' '-----' '-----' '----------'
} > "$OUT_DIR/table.txt"
{
  echo '| Provider | Status | Pass | Fail | Flaky | Skip | Duration |'
  echo '| :--- | :--- | ---: | ---: | ---: | ---: | ---: |'
} > "$OUT_DIR/table.md"

tot_pass=0; tot_fail=0; tot_flaky=0; tot_skip=0; tot_dur_ms=0
any_failed=false; any_ran=false

for p in "${providers[@]}"; do
  dir="${IN_DIR}/sso-login-outcome-${p}"
  status_file="${dir}/status.txt"
  results_file="${dir}/results.json"

  if [ ! -f "$status_file" ]; then
    # Outcome artifact missing — leg was cancelled or the runner never
    # completed the "Record leg outcome" step. Treat as failure so the
    # overall verdict never posts PASSED while a leg is unaccounted for;
    # mirrors the completed-but-no-report branch below.
    any_failed=true
    emit_row "$p" 'UNKNOWN' ':grey_question: unknown' '-' '-' '-' '-' '-'
    continue
  fi

  status=$(cat "$status_file")
  case "$status" in
    skipped)
      emit_row "$p" 'skipped' ':fast_forward: skipped' '-' '-' '-' '-' '-'
      ;;
    setup-failed)
      any_failed=true
      emit_row "$p" 'SETUP-FAIL' ':x: setup-fail' '-' '-' '-' '-' '-'
      ;;
    completed)
      any_ran=true
      if [ ! -f "$results_file" ]; then
        any_failed=true
        emit_row "$p" 'NO-REPORT' ':x: no-report' '-' '-' '-' '-' '-'
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
          txt_label='FAIL'
          md_label=':x: fail'
        elif [ "$flaky" -gt 0 ]; then
          txt_label='flaky'
          md_label=':warning: flaky'
        else
          txt_label='pass'
          md_label=':white_check_mark: pass'
        fi
        emit_row "$p" "$txt_label" "$md_label" \
          "$pass" "$fail" "$flaky" "$skip" "$(fmt_duration "$dur_int")"
      fi
      ;;
    *)
      # Unrecognized status value — someone added a new branch to
      # `Record leg outcome` without extending the parser. Same policy
      # as missing-artifact: fail loud rather than silently PASSED.
      any_failed=true
      emit_row "$p" 'UNKNOWN' ':grey_question: unknown' '-' '-' '-' '-' '-'
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
