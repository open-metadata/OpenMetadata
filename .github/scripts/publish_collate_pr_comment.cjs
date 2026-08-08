/*
 * Copyright 2026 Collate
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const fs = require('fs');

const COMMENT_MARKER = '<!-- collate-ci-failure -->';
const COMMENT_AUTHOR = 'github-actions[bot]';
const MAX_LOG_BYTES = 4 * 1024 * 1024;
const MAX_EXCERPT_LINES = 12;
const MAX_LINE_LENGTH = 400;
const MAX_EXCERPT_LENGTH = 2_000;

function readLogTail(logPath) {
  if (!logPath || !fs.existsSync(logPath) || !fs.lstatSync(logPath).isFile()) {
    return '';
  }

  const descriptor = fs.openSync(logPath, 'r');
  try {
    const size = fs.fstatSync(descriptor).size;
    const length = Math.min(size, MAX_LOG_BYTES);
    const buffer = Buffer.alloc(length);
    fs.readSync(descriptor, buffer, 0, length, size - length);
    return buffer.toString('utf8');
  } finally {
    fs.closeSync(descriptor);
  }
}

function cleanLogLine(line) {
  const columns = line.split('\t');
  const message = columns.length >= 3 ? columns.slice(2).join('\t') : line;

  return message
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s*/, '')
    .replace(/##\[(?:error|warning)\]/gi, '')
    .replace(
      /\/home\/runner\/(?:_work|work)\/[^\s]*?(?=(?:collate-service|OpenMetadata|ai-platform)\/)/g,
      '<workspace>/'
    )
    .replace(/\/home\/runner\/(?:_work|work)\/[^\s]+/g, '<workspace>')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/`/g, "'")
    .replace(/@/g, '@\u200b')
    .trim();
}

function isDiagnostic(line) {
  if (/^\[ERROR\]/i.test(line)) {
    return true;
  }
  return /^(?:COMPILATION ERROR|Compilation failure|Failed to execute goal|Tests run:|.*<<< (?:FAILURE|ERROR)!|required:|found:|reason:|\[INFO\] BUILD FAILURE|Process completed with exit code)/i.test(line);
}

function extractDiagnostics(logText) {
  const diagnostics = [];
  const seen = new Set();

  for (const rawLine of logText.split(/\r?\n/)) {
    const line = cleanLogLine(rawLine);
    if (!line || !isDiagnostic(line) || seen.has(line)) {
      continue;
    }

    const boundedLine = line.slice(0, MAX_LINE_LENGTH);
    diagnostics.push(boundedLine);
    seen.add(line);
    if (diagnostics.length === MAX_EXCERPT_LINES) {
      break;
    }
  }

  return diagnostics.join('\n').slice(0, MAX_EXCERPT_LENGTH).trim();
}

function classifyFailure(logText) {
  if (
    /(?:COMPILATION ERROR|Compilation failure|method .* cannot be applied to given types)/is.test(
      logText
    )
  ) {
    return 'Collate compilation failed';
  }
  if (
    /(?:Tests run:.*(?:Failures: [1-9]|Errors: [1-9])|<<< (?:FAILURE|ERROR)!)/is.test(
      logText
    )
  ) {
    return 'Collate integration tests failed';
  }
  return 'Collate workflow failed or could not be completed';
}

function validatedMetadata() {
  const sha = process.env.OPENMETADATA_SHA ?? '';
  const collateRef = process.env.COLLATE_REF ?? '';
  const runUrl = process.env.COLLATE_RUN_URL ?? '';

  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    throw new Error('OPENMETADATA_SHA must be a 40-character commit SHA.');
  }
  if (!/^[A-Za-z0-9._/-]{1,255}$/.test(collateRef)) {
    throw new Error('COLLATE_REF contains unsupported characters.');
  }
  if (
    runUrl &&
    !/^https:\/\/github\.com\/open-metadata\/openmetadata-collate\/actions\/runs\/\d+$/.test(
      runUrl
    )
  ) {
    throw new Error('COLLATE_RUN_URL is not a Collate Actions run URL.');
  }

  return { sha, collateRef, runUrl };
}

function buildFailureComment(logText, metadata) {
  const reason = classifyFailure(logText);
  const excerpt = extractDiagnostics(logText);
  const runLine = metadata.runUrl
    ? `**Downstream run:** [Open Collate workflow](${metadata.runUrl})`
    : '**Downstream run:** unavailable because dispatch did not complete';
  const excerptSection = excerpt
    ? `\n\n<details>\n<summary>Sanitized failure excerpt</summary>\n\n\`\`\`text\n${excerpt}\n\`\`\`\n</details>`
    : '';

  return `${COMMENT_MARKER}
## Collate compatibility check failed

**Reason:** ${reason}

**Tested:** OpenMetadata \`${metadata.sha.slice(0, 12)}\` against Collate \`${metadata.collateRef}\`

${runLine}${excerptSection}

The excerpt is limited to selected build/test diagnostics. Open the downstream run for the complete logs.`;
}

async function findExistingComment({ github, context, issueNumber }) {
  for await (const response of github.paginate.iterator(
    github.rest.issues.listComments,
    {
      ...context.repo,
      issue_number: issueNumber,
      per_page: 100,
    }
  )) {
    const comment = response.data.find(
      (candidate) =>
        candidate.user?.login === COMMENT_AUTHOR &&
        candidate.body?.includes(COMMENT_MARKER)
    );
    if (comment) {
      return comment;
    }
  }
  return null;
}

async function publishCollatePrComment({ github, context, core }) {
  const issueNumber = context.payload.pull_request?.number;
  if (!Number.isSafeInteger(issueNumber) || issueNumber < 1) {
    core.info('Skipping Collate PR reporting outside a pull-request event.');
    return;
  }

  const existingComment = await findExistingComment({
    github,
    context,
    issueNumber,
  });
  const outcome = process.env.COLLATE_DISPATCH_OUTCOME ?? '';

  if (outcome === 'success') {
    if (existingComment) {
      await github.rest.issues.deleteComment({
        ...context.repo,
        comment_id: existingComment.id,
      });
    }
    return;
  }

  const metadata = validatedMetadata();
  const logText = readLogTail(process.env.COLLATE_LOG_PATH);
  const body = buildFailureComment(logText, metadata);

  if (existingComment) {
    await github.rest.issues.updateComment({
      ...context.repo,
      comment_id: existingComment.id,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      ...context.repo,
      issue_number: issueNumber,
      body,
    });
  }
}

module.exports = publishCollatePrComment;
