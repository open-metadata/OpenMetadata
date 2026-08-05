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

module.exports = async function publishPlaywrightPrComment({
  github,
  context,
  core,
}) {
  const fs = require('fs');

  const run = context.payload.workflow_run;
  const sourceSha = run.head_sha;
  const runAttempt = run.run_attempt ?? 1;
  const allowedEvents = new Set(['pull_request', 'workflow_dispatch']);
  const marker = '<!-- playwright-summary -->';
  const runMarker = `<!-- playwright-run:${run.id}:${runAttempt} -->`;
  const payloadPath = process.env.COMMENT_PAYLOAD_PATH;
  const maximumPayloadBytes = 262144;
  const maximumCount = 1000000;
  const maximumShards = 256;
  const maximumInfrastructureIssueCount = 1024;
  const maximumPublishedInfrastructureIssues = 100;
  const maximumPublishedTests = 30;

  function assertExactObject(value, label, expectedKeys) {
    if (
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      throw new Error(`${label} must be an object.`);
    }
    const actualKeys = Object.keys(value).sort();
    const sortedExpectedKeys = [...expectedKeys].sort();
    if (
      actualKeys.length !== sortedExpectedKeys.length ||
      actualKeys.some((key, index) => key !== sortedExpectedKeys[index])
    ) {
      throw new Error(
        `${label} must contain exactly: ${sortedExpectedKeys.join(', ')}.`
      );
    }
    return value;
  }

  function assertInteger(value, label, minimum, maximum) {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      throw new Error(
        `${label} must be an integer from ${minimum} to ${maximum}.`
      );
    }
    return value;
  }

  function assertNumber(value, label, minimum, maximum) {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < minimum ||
      value > maximum
    ) {
      throw new Error(
        `${label} must be a number from ${minimum} to ${maximum}.`
      );
    }
    return value;
  }

  function assertString(value, label, minimumLength, maximumLength, pattern) {
    if (
      typeof value !== 'string' ||
      value.length < minimumLength ||
      value.length > maximumLength ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value) ||
      (pattern && !pattern.test(value))
    ) {
      throw new Error(
        `${label} must be a string from ${minimumLength} to ${maximumLength} characters.`
      );
    }
    return value;
  }

  function assertBoolean(value, label) {
    if (typeof value !== 'boolean') {
      throw new Error(`${label} must be a boolean.`);
    }
    return value;
  }

  function assertArray(value, label, maximumLength) {
    if (!Array.isArray(value) || value.length > maximumLength) {
      throw new Error(
        `${label} must be an array with at most ${maximumLength} items.`
      );
    }
    return value;
  }

  function escapeHtml(value) {
    return value
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/@/g, '&#64;');
  }

  function escapeMarkdown(value) {
    return value
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/[\\`*_{}\[\]()#+\-.!|>~]/g, '\\$&');
  }

  if (!allowedEvents.has(run.event)) {
    core.info(`Ignoring Playwright run triggered by ${run.event}.`);
    return;
  }
  if (typeof sourceSha !== 'string' || !/^[0-9a-f]{40}$/i.test(sourceSha)) {
    throw new Error(
      'The completed Playwright run did not identify a valid source SHA.'
    );
  }
  assertInteger(run.id, 'workflow_run.id', 1, Number.MAX_SAFE_INTEGER);
  assertInteger(runAttempt, 'workflow_run.run_attempt', 1, 1000);
  if (!fs.existsSync(payloadPath) || !fs.lstatSync(payloadPath).isFile()) {
    throw new Error(
      'The Playwright comment artifact did not contain summary.json.'
    );
  }
  if (fs.statSync(payloadPath).size > maximumPayloadBytes) {
    throw new Error('The Playwright comment payload exceeds 256 KiB.');
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `The Playwright comment payload is not valid JSON: ${error.message}`
    );
  }

  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    Object.getPrototypeOf(payload) !== Object.prototype
  ) {
    throw new Error('payload must be an object.');
  }
  const payloadVersion = payload.version;
  if (
    !Number.isSafeInteger(payloadVersion) ||
    ![1, 2].includes(payloadVersion)
  ) {
    throw new Error(
      `Unsupported Playwright comment payload version ${payloadVersion}.`
    );
  }
  const hasLifecycleDetails = payloadVersion >= 2;
  assertExactObject(payload, 'payload', [
    'version',
    'totals',
    'shards',
    'infrastructureIssueCount',
    'infrastructureIssues',
    'failures',
    'flakyTests',
    ...(hasLifecycleDetails ? ['lifecycleFlakyTests', 'performance'] : []),
  ]);

  const totals = assertExactObject(payload.totals, 'payload.totals', [
    'passed',
    'failed',
    'flaky',
    'skipped',
    ...(hasLifecycleDetails ? ['zeroAttemptSkipped', 'lifecycleFlaky'] : []),
  ]);
  for (const key of ['passed', 'failed', 'flaky', 'skipped']) {
    assertInteger(totals[key], `payload.totals.${key}`, 0, maximumCount);
  }
  const zeroAttemptSkipped = hasLifecycleDetails
    ? assertInteger(
        totals.zeroAttemptSkipped,
        'payload.totals.zeroAttemptSkipped',
        0,
        maximumCount
      )
    : 0;
  const lifecycleFlaky = hasLifecycleDetails
    ? assertInteger(
        totals.lifecycleFlaky,
        'payload.totals.lifecycleFlaky',
        0,
        maximumCount
      )
    : 0;
  if (zeroAttemptSkipped > totals.skipped) {
    throw new Error(
      'payload.totals.zeroAttemptSkipped cannot exceed payload.totals.skipped.'
    );
  }

  const shardIds = new Set();
  const shardTotals = {
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    lifecycleFailed: 0,
    lifecycleFlaky: 0,
  };
  const shards = assertArray(payload.shards, 'payload.shards', maximumShards);
  for (const [index, shard] of shards.entries()) {
    assertExactObject(shard, `payload.shards[${index}]`, [
      'id',
      'expected',
      'present',
      'passed',
      'failed',
      'flaky',
      'skipped',
      ...(hasLifecycleDetails ? ['lifecycleFailed', 'lifecycleFlaky'] : []),
    ]);
    assertString(
      shard.id,
      `payload.shards[${index}].id`,
      1,
      64,
      /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/
    );
    if (shardIds.has(shard.id)) {
      throw new Error(`payload.shards contains duplicate id ${shard.id}.`);
    }
    shardIds.add(shard.id);
    assertBoolean(shard.expected, `payload.shards[${index}].expected`);
    assertBoolean(shard.present, `payload.shards[${index}].present`);
    const shardCountKeys = [
      'passed',
      'failed',
      'flaky',
      'skipped',
      ...(hasLifecycleDetails ? ['lifecycleFailed', 'lifecycleFlaky'] : []),
    ];
    for (const key of shardCountKeys) {
      const count = assertInteger(
        shard[key],
        `payload.shards[${index}].${key}`,
        0,
        maximumCount
      );
      if (!shard.present && count !== 0) {
        throw new Error(
          `Missing shard ${shard.id} cannot report ${key} tests.`
        );
      }
      shardTotals[key] += count;
    }
    if (!hasLifecycleDetails) {
      shard.lifecycleFailed = 0;
      shard.lifecycleFlaky = 0;
    }
  }
  for (const key of ['passed', 'failed', 'flaky', 'skipped']) {
    if (shardTotals[key] !== totals[key]) {
      throw new Error(
        `payload.totals.${key} does not equal the sum of shard ${key} counts.`
      );
    }
  }
  if (shardTotals.lifecycleFlaky !== lifecycleFlaky) {
    throw new Error(
      'payload.totals.lifecycleFlaky does not equal the sum of shard lifecycleFlaky counts.'
    );
  }

  const infrastructureIssueCount = assertInteger(
    payload.infrastructureIssueCount,
    'payload.infrastructureIssueCount',
    0,
    maximumInfrastructureIssueCount
  );
  const infrastructureIssues = assertArray(
    payload.infrastructureIssues,
    'payload.infrastructureIssues',
    maximumPublishedInfrastructureIssues
  );
  if (
    infrastructureIssues.length !==
    Math.min(infrastructureIssueCount, maximumPublishedInfrastructureIssues)
  ) {
    throw new Error(
      'payload.infrastructureIssues has an inconsistent item count.'
    );
  }
  for (const [index, issue] of infrastructureIssues.entries()) {
    assertString(issue, `payload.infrastructureIssues[${index}]`, 1, 500);
  }
  if (new Set(infrastructureIssues).size !== infrastructureIssues.length) {
    throw new Error(
      'payload.infrastructureIssues must not contain duplicates.'
    );
  }

  const failures = assertArray(
    payload.failures,
    'payload.failures',
    maximumPublishedTests
  );
  if (failures.length !== Math.min(totals.failed, maximumPublishedTests)) {
    throw new Error('payload.failures has an inconsistent item count.');
  }
  for (const [index, failure] of failures.entries()) {
    assertExactObject(failure, `payload.failures[${index}]`, [
      'shard',
      'file',
      'title',
      'error',
    ]);
    assertString(failure.shard, `payload.failures[${index}].shard`, 1, 64);
    if (!shardIds.has(failure.shard)) {
      throw new Error(
        `payload.failures[${index}] references an unknown shard.`
      );
    }
    assertString(failure.file, `payload.failures[${index}].file`, 0, 300);
    assertString(failure.title, `payload.failures[${index}].title`, 0, 300);
    assertString(failure.error, `payload.failures[${index}].error`, 0, 1000);
  }

  const flakyTests = assertArray(
    payload.flakyTests,
    'payload.flakyTests',
    maximumPublishedTests
  );
  if (flakyTests.length !== Math.min(totals.flaky, maximumPublishedTests)) {
    throw new Error('payload.flakyTests has an inconsistent item count.');
  }
  for (const [index, flakyTest] of flakyTests.entries()) {
    assertExactObject(flakyTest, `payload.flakyTests[${index}]`, [
      'shard',
      'file',
      'title',
      'retries',
    ]);
    assertString(flakyTest.shard, `payload.flakyTests[${index}].shard`, 1, 64);
    if (!shardIds.has(flakyTest.shard)) {
      throw new Error(
        `payload.flakyTests[${index}] references an unknown shard.`
      );
    }
    assertString(flakyTest.file, `payload.flakyTests[${index}].file`, 0, 300);
    assertString(flakyTest.title, `payload.flakyTests[${index}].title`, 0, 300);
    assertInteger(
      flakyTest.retries,
      `payload.flakyTests[${index}].retries`,
      0,
      100
    );
  }

  const lifecycleFlakyTests = hasLifecycleDetails
    ? assertArray(
        payload.lifecycleFlakyTests,
        'payload.lifecycleFlakyTests',
        maximumPublishedTests
      )
    : [];
  if (
    lifecycleFlakyTests.length !==
    Math.min(lifecycleFlaky, maximumPublishedTests)
  ) {
    throw new Error(
      'payload.lifecycleFlakyTests has an inconsistent item count.'
    );
  }
  for (const [index, flakyTest] of lifecycleFlakyTests.entries()) {
    assertExactObject(flakyTest, `payload.lifecycleFlakyTests[${index}]`, [
      'shard',
      'file',
      'title',
      'retries',
    ]);
    assertString(
      flakyTest.shard,
      `payload.lifecycleFlakyTests[${index}].shard`,
      1,
      64
    );
    if (!shardIds.has(flakyTest.shard)) {
      throw new Error(
        `payload.lifecycleFlakyTests[${index}] references an unknown shard.`
      );
    }
    assertString(
      flakyTest.file,
      `payload.lifecycleFlakyTests[${index}].file`,
      0,
      300
    );
    assertString(
      flakyTest.title,
      `payload.lifecycleFlakyTests[${index}].title`,
      0,
      300
    );
    assertInteger(
      flakyTest.retries,
      `payload.lifecycleFlakyTests[${index}].retries`,
      0,
      100
    );
  }

  let performance;
  if (hasLifecycleDetails) {
    performance = payload.performance;
    if (performance !== null) {
      assertExactObject(performance, 'payload.performance', [
        'blockingTargetsMet',
        'convergenceTargetsMet',
        'metrics',
        'convergenceWarnings',
      ]);
    }
  }
  if (performance) {
    assertBoolean(
      performance.blockingTargetsMet,
      'payload.performance.blockingTargetsMet'
    );
    assertBoolean(
      performance.convergenceTargetsMet,
      'payload.performance.convergenceTargetsMet'
    );
    const performanceMetrics = assertExactObject(
      performance.metrics,
      'payload.performance.metrics',
      [
        'maxEnvironmentSeconds',
        'maxExecutionSeconds',
        'maxElapsedBeforeUploadSeconds',
        'reportingSeconds',
        'workflowWallSeconds',
        'requestsPerAttempt',
        'appBootsPerUIScenario',
        'commonShardSkewPercent',
      ]
    );
    for (const key of [
      'maxEnvironmentSeconds',
      'maxExecutionSeconds',
      'maxElapsedBeforeUploadSeconds',
      'reportingSeconds',
      'workflowWallSeconds',
    ]) {
      assertInteger(
        performanceMetrics[key],
        `payload.performance.metrics.${key}`,
        0,
        maximumCount
      );
    }
    for (const key of ['requestsPerAttempt', 'appBootsPerUIScenario']) {
      assertNumber(
        performanceMetrics[key],
        `payload.performance.metrics.${key}`,
        0,
        maximumCount
      );
    }
    assertNumber(
      performanceMetrics.commonShardSkewPercent,
      'payload.performance.metrics.commonShardSkewPercent',
      0,
      100
    );
    const convergenceWarnings = assertArray(
      performance.convergenceWarnings,
      'payload.performance.convergenceWarnings',
      3
    );
    for (const [index, warning] of convergenceWarnings.entries()) {
      assertString(
        warning,
        `payload.performance.convergenceWarnings[${index}]`,
        1,
        300
      );
    }
    if (new Set(convergenceWarnings).size !== convergenceWarnings.length) {
      throw new Error(
        'payload.performance.convergenceWarnings must not contain duplicates.'
      );
    }
    if (performance.convergenceTargetsMet && convergenceWarnings.length !== 0) {
      throw new Error(
        'payload.performance.convergenceWarnings must be empty when convergence targets are met.'
      );
    }
    if (
      !performance.convergenceTargetsMet &&
      convergenceWarnings.length === 0
    ) {
      throw new Error(
        'payload.performance.convergenceWarnings must describe unmet convergence targets.'
      );
    }
  }

  if (
    run.conclusion === 'success' &&
    (totals.failed !== 0 ||
      shardTotals.lifecycleFailed !== 0 ||
      infrastructureIssueCount !== 0 ||
      (performance && !performance.blockingTargetsMet))
  ) {
    throw new Error(
      'A successful workflow cannot report test or infrastructure failures.'
    );
  }

  const conclusionPresentation = {
    success: { icon: '✅', label: 'succeeded' },
    failure: { icon: '🔴', label: 'failed' },
    cancelled: { icon: '⚪', label: 'was cancelled' },
    timed_out: { icon: '🔴', label: 'timed out' },
    neutral: { icon: '⚪', label: 'finished neutral' },
    skipped: { icon: '⚪', label: 'was skipped' },
    stale: { icon: '⚪', label: 'became stale' },
    action_required: { icon: '🟡', label: 'requires action' },
    startup_failure: { icon: '🔴', label: 'failed to start' },
  };
  const presentation = conclusionPresentation[run.conclusion] ?? {
    icon: '⚪',
    label: 'finished with an unknown conclusion',
  };
  const formatDuration = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds}s`;
    }
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };
  const repo = context.repo;
  const runUrl = `https://github.com/${repo.owner}/${repo.repo}/actions/runs/${run.id}`;
  const zeroAttemptSkippedText =
    zeroAttemptSkipped > 0
      ? ` (${zeroAttemptSkipped} zero-attempt; reason unknown)`
      : '';
  const lifecycleFlakyText = hasLifecycleDetails
    ? ` · 🧰 ${lifecycleFlaky} lifecycle flaky`
    : '';
  const lines = [
    marker,
    runMarker,
    `## ${presentation.icon} Playwright Results — workflow ${presentation.label}`,
    '',
    `Validated commit \`${sourceSha}\` in [Playwright run ${run.id}, attempt ${runAttempt}](${runUrl}).`,
    '',
    `✅ ${totals.passed} passed · ❌ ${totals.failed} failed · ` +
      `🟡 ${totals.flaky} flaky · ⏭️ ${totals.skipped} skipped` +
      `${zeroAttemptSkippedText}${lifecycleFlakyText}`,
    '',
  ];

  if (infrastructureIssueCount > 0) {
    lines.push(`### Pipeline and setup failures (${infrastructureIssueCount})`);
    lines.push('');
    for (const issue of infrastructureIssues) {
      lines.push(`- <code>${escapeHtml(issue)}</code>`);
    }
    if (infrastructureIssueCount > infrastructureIssues.length) {
      lines.push(
        `- ... and ${
          infrastructureIssueCount - infrastructureIssues.length
        } more`
      );
    }
    lines.push('');
  }

  if (performance) {
    const metrics = performance.metrics;
    const blockingStatus = performance.blockingTargetsMet
      ? '✅ met'
      : '❌ unmet';
    const convergenceStatus = performance.convergenceTargetsMet
      ? '✅ met'
      : '🟡 in progress';
    lines.push('### Performance');
    lines.push('');
    lines.push(
      `Blocking targets: ${blockingStatus} · Optimization targets: ${convergenceStatus}`
    );
    lines.push('');
    lines.push(
      'Shard-job maxima below are not the full workflow wall time; the linked run includes build, fixture, planning, and reporting.'
    );
    lines.push('');
    lines.push(
      `🕒 Full workflow signal wall (to summary) ${formatDuration(
        metrics.workflowWallSeconds
      )}`
    );
    lines.push('');
    lines.push(
      `⏱️ Max setup ${formatDuration(metrics.maxEnvironmentSeconds)} · ` +
        `max shard execution ${formatDuration(
          metrics.maxExecutionSeconds
        )} · ` +
        `max shard-job elapsed before upload ${formatDuration(
          metrics.maxElapsedBeforeUploadSeconds
        )} · ` +
        `reporting ${formatDuration(metrics.reportingSeconds)}`
    );
    lines.push('');
    lines.push(
      `🌐 ${metrics.requestsPerAttempt.toFixed(2)} requests/attempt · ` +
        `${metrics.appBootsPerUIScenario.toFixed(2)} app boots/UI scenario · ` +
        `${metrics.commonShardSkewPercent.toFixed(2)}% common-shard skew`
    );
    lines.push('');
    if (performance.convergenceWarnings.length > 0) {
      lines.push('Optimization targets still in progress:');
      for (const warning of performance.convergenceWarnings) {
        lines.push(`- ${escapeMarkdown(warning)}`);
      }
      lines.push('');
    }
  } else if (hasLifecycleDetails) {
    lines.push('### Performance');
    lines.push('');
    lines.push(
      '⚪ Performance metrics unavailable; see the CI and reporting failures above.'
    );
    lines.push('');
  }

  if (zeroAttemptSkipped > 0) {
    lines.push('### Zero-attempt skipped tests');
    lines.push('');
    lines.push(
      `${zeroAttemptSkipped} planned test(s) were reported as skipped with no attempts. ` +
        'They remain included in coverage; Playwright did not report a reliable reason.'
    );
    lines.push('');
  }

  const shardHeaders = hasLifecycleDetails
    ? '| Shard | Passed | Failed | Flaky | Skipped | Lifecycle failed | Lifecycle flaky |'
    : '| Shard | Passed | Failed | Flaky | Skipped |';
  const shardSeparators = hasLifecycleDetails
    ? '|-------|--------|--------|-------|---------|------------------|-----------------|'
    : '|-------|--------|--------|-------|---------|';
  lines.push(shardHeaders);
  lines.push(shardSeparators);
  for (const shard of shards.filter((item) => item.expected)) {
    if (!shard.present) {
      lines.push(
        hasLifecycleDetails
          ? `| ⛔ Shard ${escapeMarkdown(shard.id)} | — | — | — | — | — | — |`
          : `| ⛔ Shard ${escapeMarkdown(shard.id)} | — | — | — | — |`
      );
      continue;
    }
    const status =
      shard.failed > 0 || shard.lifecycleFailed > 0
        ? '🔴'
        : shard.flaky > 0 || shard.lifecycleFlaky > 0
        ? '🟡'
        : '✅';
    lines.push(
      hasLifecycleDetails
        ? `| ${status} Shard ${escapeMarkdown(shard.id)} | ${shard.passed} | ${
            shard.failed
          } | ${shard.flaky} | ${shard.skipped} | ${shard.lifecycleFailed} | ${
            shard.lifecycleFlaky
          } |`
        : `| ${status} Shard ${escapeMarkdown(shard.id)} | ${shard.passed} | ${
            shard.failed
          } | ${shard.flaky} | ${shard.skipped} |`
    );
  }
  lines.push('');

  if (failures.length > 0) {
    lines.push('### Genuine Failures (failed on all attempts)');
    lines.push('');
    for (const failure of failures) {
      const shortFile = failure.file.replace(/.*playwright\/e2e\//, '');
      lines.push(
        `<details><summary>❌ <code>${escapeHtml(
          shortFile
        )}</code> › <code>${escapeHtml(
          failure.title
        )}</code> (shard ${escapeHtml(failure.shard)})</summary>`
      );
      lines.push('');
      lines.push(`<pre><code>${escapeHtml(failure.error)}</code></pre>`);
      lines.push('</details>');
      lines.push('');
    }
    if (totals.failed > failures.length) {
      lines.push(`... and ${totals.failed - failures.length} more failures`);
      lines.push('');
    }
  }

  if (flakyTests.length > 0) {
    lines.push(
      `<details><summary>🟡 ${totals.flaky} flaky test(s) (passed on retry)</summary>`
    );
    lines.push('');
    for (const flakyTest of flakyTests) {
      const shortFile = flakyTest.file.replace(/.*playwright\/e2e\//, '');
      lines.push(
        `- <code>${escapeHtml(shortFile)}</code> › <code>${escapeHtml(
          flakyTest.title
        )}</code> (shard ${escapeHtml(flakyTest.shard)}, ${flakyTest.retries} ${
          flakyTest.retries === 1 ? 'retry' : 'retries'
        })`
      );
    }
    if (totals.flaky > flakyTests.length) {
      lines.push(`- ... and ${totals.flaky - flakyTests.length} more`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  if (lifecycleFlakyTests.length > 0) {
    lines.push(
      `<details><summary>🧰 ${lifecycleFlaky} flaky lifecycle test(s) (passed on retry)</summary>`
    );
    lines.push('');
    for (const flakyTest of lifecycleFlakyTests) {
      const shortFile = flakyTest.file.replace(/.*playwright\/e2e\//, '');
      lines.push(
        `- <code>${escapeHtml(shortFile)}</code> › <code>${escapeHtml(
          flakyTest.title
        )}</code> (shard ${escapeHtml(flakyTest.shard)}, ${flakyTest.retries} ${
          flakyTest.retries === 1 ? 'retry' : 'retries'
        })`
      );
    }
    if (lifecycleFlaky > lifecycleFlakyTests.length) {
      lines.push(
        `- ... and ${lifecycleFlaky - lifecycleFlakyTests.length} more`
      );
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  lines.push(`📦 [Download artifacts](${runUrl})`);
  lines.push('');
  lines.push('<details><summary>How to debug locally</summary>');
  lines.push('');
  lines.push('```bash');
  lines.push('# Download playwright-test-results-<shard> artifact and unzip');
  lines.push('npx playwright show-trace path/to/trace.zip    # view trace');
  lines.push('```');
  lines.push('</details>');

  const body = lines.join('\n');
  if (Buffer.byteLength(body, 'utf8') > 65536) {
    throw new Error('The validated Playwright comment exceeds 64 KiB.');
  }

  const repositoryId = run.repository?.id;
  const payloadPullNumbers = [
    ...new Set(
      (run.pull_requests || [])
        .filter(
          (pull) => !pull.base?.repo?.id || pull.base.repo.id === repositoryId
        )
        .map((pull) => pull.number)
        .filter(Number.isInteger)
    ),
  ];

  let candidates = [];
  if (payloadPullNumbers.length > 0) {
    for (const pullNumber of payloadPullNumbers) {
      const { data: pull } = await github.rest.pulls.get({
        ...repo,
        pull_number: pullNumber,
      });
      if (pull.state === 'open') candidates.push(pull);
    }
  } else {
    const { data: associatedPulls } =
      await github.rest.repos.listPullRequestsAssociatedWithCommit({
        ...repo,
        commit_sha: sourceSha,
        per_page: 100,
      });
    candidates = associatedPulls.filter(
      (pull) =>
        pull.state === 'open' &&
        pull.head?.sha === sourceSha &&
        pull.base?.repo?.full_name === `${repo.owner}/${repo.repo}`
    );
  }

  const matchingPulls = candidates.filter(
    (pull) => pull.head?.sha === sourceSha
  );
  if (matchingPulls.length === 0) {
    if (candidates.length > 0) {
      core.notice(
        `Skipping stale Playwright run ${run.id}: source ${sourceSha} is no longer an open PR head.`
      );
    } else {
      core.notice(
        `No open pull request is associated with Playwright source ${sourceSha}.`
      );
    }
    return;
  }
  if (matchingPulls.length > 1) {
    core.warning(
      `Playwright source ${sourceSha} is the head of multiple open pull requests; refusing to choose one.`
    );
    return;
  }

  const { data: pull } = await github.rest.pulls.get({
    ...repo,
    pull_number: matchingPulls[0].number,
  });
  if (pull.state !== 'open' || pull.head?.sha !== sourceSha) {
    core.notice(
      `Skipping stale Playwright run ${run.id}: PR #${pull.number} now points to ${pull.head?.sha}.`
    );
    return;
  }

  let existingComment;
  for await (const response of github.paginate.iterator(
    github.rest.issues.listComments,
    { ...repo, issue_number: pull.number, per_page: 100 }
  )) {
    existingComment = response.data.find(
      (comment) =>
        comment.user?.login === 'github-actions[bot]' &&
        comment.body?.includes(marker)
    );
    if (existingComment) break;
  }

  const existingRunMatch = existingComment?.body?.match(
    /<!-- playwright-run:(\d+):(\d+) -->/
  );
  if (existingRunMatch) {
    const existingRunId = BigInt(existingRunMatch[1]);
    const existingAttempt = BigInt(existingRunMatch[2]);
    const currentRunId = BigInt(String(run.id));
    const currentAttempt = BigInt(String(runAttempt));
    const existingRunIsNewer =
      existingRunId > currentRunId ||
      (existingRunId === currentRunId && existingAttempt > currentAttempt);

    if (existingRunIsNewer) {
      core.notice(
        `Skipping Playwright run ${run.id} attempt ${runAttempt}: the PR comment already contains newer run ${existingRunId} attempt ${existingAttempt}.`
      );
      return;
    }
  }

  const { data: currentPull } = await github.rest.pulls.get({
    ...repo,
    pull_number: pull.number,
  });
  if (currentPull.state !== 'open' || currentPull.head?.sha !== sourceSha) {
    core.notice(
      `Skipping stale Playwright run ${run.id}: PR #${currentPull.number} now points to ${currentPull.head?.sha}.`
    );
    return;
  }

  if (existingComment) {
    await github.rest.issues.updateComment({
      ...repo,
      comment_id: existingComment.id,
      body,
    });
  } else {
    await github.rest.issues.createComment({
      ...repo,
      issue_number: currentPull.number,
      body,
    });
  }
};
