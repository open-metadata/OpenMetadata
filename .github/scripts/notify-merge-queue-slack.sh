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
# Required env: SLACK_BOT_USER_OAUTH_TOKEN, SLACK_CHANNEL, WORKFLOW_NAME,
#   CONCLUSION, RUN_URL, PR_NUMBER, PR_TITLE, PR_AUTHOR, REPO_URL, HEAD_BRANCH
# Optional env: TEXT_PREFIX, OWNER_HANDLE, OWNER_GROUP_ID

set -euo pipefail

for var in SLACK_BOT_USER_OAUTH_TOKEN SLACK_CHANNEL WORKFLOW_NAME CONCLUSION \
  RUN_URL PR_NUMBER REPO_URL HEAD_BRANCH; do
  if [ -z "${!var:-}" ]; then
    echo "::error::${var} is empty; cannot post to Slack."
    exit 1
  fi
done

queue_branch=$(printf '%s' "$HEAD_BRANCH" | cut -d/ -f2)

# Title and author are best-effort; the message must read correctly without them.
link_text="#${PR_NUMBER}"
if [ -n "${PR_TITLE:-}" ]; then
  link_text="${link_text} ${PR_TITLE}"
fi
author_suffix=""
if [ -n "${PR_AUTHOR:-}" ]; then
  author_suffix=" (@${PR_AUTHOR})"
fi

# A bare "@handle" renders as plain text and notifies nobody, so the handle is
# resolved to the <!subteam^ID> form Slack actually pings. Resolution needs the
# usergroups:read scope; without it the message still goes out, unlinked.
mention=""
if [ -n "${OWNER_HANDLE:-}" ] && [ -n "${OWNER_GROUP_ID:-}" ]; then
  mention="<!subteam^${OWNER_GROUP_ID}|@${OWNER_HANDLE}> "
elif [ -n "${OWNER_HANDLE:-}" ]; then
  groups=$(curl -sS -H "Authorization: Bearer ${SLACK_BOT_USER_OAUTH_TOKEN}" \
    https://slack.com/api/usergroups.list)
  if [ "$(printf '%s' "$groups" | jq -r '.ok')" = "true" ]; then
    group_id=$(printf '%s' "$groups" \
      | jq -r --arg h "$OWNER_HANDLE" '.usergroups[]? | select(.handle == $h) | .id' | head -1)
    if [ -n "$group_id" ]; then
      mention="<!subteam^${group_id}|@${OWNER_HANDLE}> "
    else
      echo "::warning::No Slack user group with handle '${OWNER_HANDLE}'; sending an unlinked mention."
      mention="@${OWNER_HANDLE} "
    fi
  else
    echo "::warning::Could not list Slack user groups ($(printf '%s' "$groups" | jq -r '.error // "unknown"')); sending an unlinked mention."
    mention="@${OWNER_HANDLE} "
  fi
fi

text=$(printf '%s\n%s\n%s' \
  "${TEXT_PREFIX:-}${mention}:rotating_light: *Merge queue ${CONCLUSION}* — ${WORKFLOW_NAME}" \
  "<${REPO_URL}/pull/${PR_NUMBER}|${link_text}>${author_suffix}" \
  "<${RUN_URL}|Failed run> · <${REPO_URL}/queue/${queue_branch}|Merge queue>")

payload=$(jq -n --arg channel "$SLACK_CHANNEL" --arg text "$text" \
  '{channel: $channel, text: $text, unfurl_links: false, unfurl_media: false}')

response=$(curl -sS -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer ${SLACK_BOT_USER_OAUTH_TOKEN}" \
  -H 'Content-Type: application/json; charset=utf-8' \
  --data "$payload")

if [ "$(printf '%s' "$response" | jq -r '.ok')" != "true" ]; then
  echo "::error::Slack API rejected the message: $(printf '%s' "$response" | jq -r '.error // .')"
  exit 1
fi

echo "Posted merge-queue notification for PR #${PR_NUMBER} to ${SLACK_CHANNEL}."
