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
# Optional env: TEXT_PREFIX

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

text=$(printf '%s\n%s\n%s' \
  "${TEXT_PREFIX:-}:rotating_light: *Merge queue ${CONCLUSION}* — ${WORKFLOW_NAME}" \
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
