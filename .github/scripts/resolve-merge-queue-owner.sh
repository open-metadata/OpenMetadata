#!/usr/bin/env bash
#  Copyright 2025 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
# Prints the Slack user-group handle that owns a failed merge-queue run on the
# first line and its configured group ID, if any, on the second. Prints nothing
# when no owner can be determined.
#
# Required env: WORKFLOW_NAME, REPO, GH_TOKEN
# Optional env: RUN_ID (enables infra detection), OWNERS_FILE

set -euo pipefail

OWNERS_FILE="${OWNERS_FILE:-.github/merge-queue-owners.json}"

if [ ! -f "$OWNERS_FILE" ]; then
  echo "::warning::${OWNERS_FILE} not found; notifying without an owner mention." >&2
  exit 0
fi

team=$(jq -r --arg w "$WORKFLOW_NAME" '.workflows[$w] // ""' "$OWNERS_FILE")

# A failing runner, image pull or cache is a platform problem no matter which
# workflow surfaced it, so step-level detection overrides the name mapping.
if [ -n "${RUN_ID:-}" ]; then
  failed_steps=$(gh api --paginate \
    "repos/${REPO}/actions/runs/${RUN_ID}/jobs?per_page=100" \
    --jq '.jobs[] | select(.conclusion == "failure") | .steps[]? | select(.conclusion == "failure") | .name' \
    2>/dev/null || true)

  if [ -z "$failed_steps" ]; then
    echo "No failing steps resolved for run ${RUN_ID}; using the workflow mapping." >&2
  else
    infra_team=$(jq -r '.infraTeam // ""' "$OWNERS_FILE")
    while IFS= read -r step; do
      [ -z "$step" ] && continue
      step_lc=$(printf '%s' "$step" | tr '[:upper:]' '[:lower:]')
      while IFS= read -r pattern; do
        [ -z "$pattern" ] && continue
        case "$step_lc" in
          *"$pattern"*)
            echo "Failing step '${step}' matches infra pattern '${pattern}'." >&2
            team="$infra_team"
            break 3
            ;;
        esac
      done < <(jq -r '.infraStepPatterns[]? | ascii_downcase' "$OWNERS_FILE")
    done <<< "$failed_steps"
  fi
fi

if [ -z "$team" ]; then
  echo "::warning::No owner mapped for workflow '${WORKFLOW_NAME}'; notifying without a mention." >&2
  exit 0
fi

handle=$(jq -r --arg t "$team" '.teams[$t] // ""' "$OWNERS_FILE")
if [ -z "$handle" ]; then
  echo "::warning::Team '${team}' has no handle in ${OWNERS_FILE}; notifying without a mention." >&2
  exit 0
fi

printf '%s\n' "$handle"
printf '%s\n' "$(jq -r --arg t "$team" '.groupIds[$t] // ""' "$OWNERS_FILE")"
