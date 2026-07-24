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

async function renderPlaywrightSummary({ github, context, core }) {
  const fs = require('fs');
  const path = require('path');

  const checkChangesResult = process.env.CHECK_CHANGES_RESULT;
  const cacheKeysResult = process.env.CACHE_KEYS_RESULT;
  const buildResult = process.env.BUILD_RESULT;
  const detectChangesResult = process.env.DETECT_CHANGES_RESULT;
  const planResult = process.env.PLAN_RESULT;
  const fixtureRestoreResult = process.env.FIXTURE_RESTORE_RESULT;
  const fixtureResult = process.env.FIXTURE_RESULT;
  const upstreamResult = process.env.PLAYWRIGHT_RESULT;
  const eventAction = context.payload.action;
  const labelName = context.payload.label?.name ?? '';
  const isDraft = context.payload.pull_request?.draft === true;
  const isNonTestLabelEvent = eventAction === 'labeled' && labelName !== 'safe to test';
  const testsRequired = context.eventName === 'pull_request' ||
    context.eventName === 'merge_group' ||
    context.eventName === 'schedule' ||
    context.eventName === 'workflow_dispatch';

  if (isDraft) {
    console.log('Playwright E2E tests are not required while the PR is a draft.');
    return;
  }
  if (isNonTestLabelEvent) {
    console.log(`Playwright E2E tests pending — label "${labelName}" added but only "safe to test" triggers E2E. Tests will run when "safe to test" is applied or code is pushed.`);
    return;
  }
  if (checkChangesResult === 'success' && !testsRequired) {
    console.log('Playwright E2E tests not required for this PR (no relevant paths changed).');
    return;
  }

  const runId = process.env.GITHUB_RUN_ID;
  const repo = context.repo;
  const artifactUrl = `https://github.com/${repo.owner}/${repo.repo}/actions/runs/${runId}`;
  const commentMarker = '<!-- playwright-summary -->';
  const infrastructureIssues = [];
  const addInfrastructureIssue = issue => {
    if (!infrastructureIssues.includes(issue)) infrastructureIssues.push(issue);
  };
  const failedOutcome = outcome => ['failure', 'cancelled'].includes(outcome);

  let coverage;
  const coveragePath = path.join(
    process.env.RUNNER_TEMP,
    'playwright-timing-history',
    'playwright-coverage.json'
  );
  if (fs.existsSync(coveragePath)) {
    try {
      coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    } catch (error) {
      addInfrastructureIssue(`Playwright coverage output was invalid JSON: ${error.message}`);
    }
  }

  let performance;
  const performancePath = path.join(
    process.env.RUNNER_TEMP,
    'playwright-timing-history',
    'playwright-performance.json'
  );
  if (fs.existsSync(performancePath)) {
    try {
      performance = JSON.parse(fs.readFileSync(performancePath, 'utf8'));
    } catch (error) {
      addInfrastructureIssue(`Playwright performance output was invalid JSON: ${error.message}`);
    }
  }
  const finiteMetric = value =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  const displayMetric = value => finiteMetric(value) ?? 'unavailable';
  const performanceMetrics = performance?.metrics ?? {};
  const performanceTargets = performance?.targets ?? {};
  const convergenceTargets = performance?.convergenceTargets ?? {};
  if (performance) {
    try {
      const workflowRun = await github.rest.actions.getWorkflowRun({
        ...repo,
        run_id: Number(runId),
      });
      const createdAtMillis = Date.parse(workflowRun.data.created_at);
      if (!Number.isFinite(createdAtMillis)) {
        throw new Error('workflow created_at was not a valid timestamp');
      }
      performanceMetrics.workflowWallSeconds = Math.max(
        0,
        Math.round((Date.now() - createdAtMillis) / 1000)
      );
      fs.writeFileSync(
        performancePath,
        `${JSON.stringify(performance, null, 2)}\n`,
        'utf8'
      );
    } catch (error) {
      core.warning(`Could not calculate full workflow wall time: ${error.message}`);
    }
  }
  const convergenceWarnings = [];
  if (convergenceTargets.commonShardSkewAtMostFifteenPercent === false) {
    convergenceWarnings.push(
      `Common shard skew was ${displayMetric(performanceMetrics.commonShardSkewPercent)}% ` +
      '(convergence target: at most 15%).'
    );
  }
  if (convergenceTargets.requestsPerAttemptBelowTwoHundred === false) {
    convergenceWarnings.push(
      `Browser traffic was ${displayMetric(performanceMetrics.requestsPerAttempt)} requests per attempt ` +
      '(convergence target: fewer than 200).'
    );
  }
  if (convergenceTargets.atMostOneAppBootPerUIScenario === false) {
    convergenceWarnings.push(
      `Application boot ratio was ${displayMetric(performanceMetrics.appBootsPerUIScenario)} per UI scenario ` +
      `(${displayMetric(performanceMetrics.appBoots)} boots / ` +
      `${displayMetric(performanceMetrics.uiScenarios)} scenarios; convergence target: at most 1).`
    );
  }

  if (checkChangesResult !== 'success') {
    addInfrastructureIssue(`Change detection finished with status \`${checkChangesResult}\`.`);
  }
  if (cacheKeysResult !== 'success') {
    addInfrastructureIssue(`Cache fingerprinting finished with status \`${cacheKeysResult}\`.`);
  }
  if (buildResult !== 'success') {
    addInfrastructureIssue(`The build job finished with status \`${buildResult}\`.`);
  }
  if (detectChangesResult !== 'success') {
    addInfrastructureIssue(`Test selection finished with status \`${detectChangesResult}\`.`);
  }
  if (planResult !== 'success') {
    addInfrastructureIssue(`Duration-aware shard planning finished with status \`${planResult}\`.`);
  }
  if (fixtureRestoreResult !== 'success') {
    addInfrastructureIssue(`Fixture cache restoration finished with status \`${fixtureRestoreResult}\`.`);
  }
  if (fixtureResult !== 'success') {
    addInfrastructureIssue(`Seeded fixture preparation finished with status \`${fixtureResult}\`.`);
  }
  if (upstreamResult === 'cancelled') {
    addInfrastructureIssue('The Playwright shard matrix was cancelled.');
  } else if (upstreamResult === 'skipped') {
    addInfrastructureIssue('The Playwright shard matrix was unexpectedly skipped.');
  }

  const reportChecks = [
    [process.env.SUMMARY_CHECKOUT_OUTCOME, 'Summary checkout'],
    [process.env.REPORT_DOWNLOAD_BLOBS_OUTCOME, 'Blob report download'],
    [process.env.REPORT_DOWNLOAD_TIMINGS_OUTCOME, 'Timing metrics download'],
    [process.env.REPORT_DOWNLOAD_PLANS_OUTCOME, 'Shard-plan download'],
    [process.env.REPORT_DOWNLOAD_RESULTS_OUTCOME, 'Native Playwright result download'],
    [process.env.REPORT_SETUP_NODE_OUTCOME, 'Summary Node.js setup'],
    [process.env.REPORT_INSTALL_OUTCOME, 'Summary dependency installation'],
    [process.env.REPORT_START_OUTCOME, 'Summary timer initialization'],
    [process.env.REPORT_MERGE_OUTCOME, 'HTML report merge'],
    [process.env.REPORT_TIMING_MERGE_OUTCOME, 'Timing-history merge'],
    [process.env.REPORT_PERFORMANCE_OUTCOME, 'Performance target evaluation'],
    [process.env.REPORT_UPLOAD_OUTCOME, 'Merged report upload'],
    [process.env.REPORT_DURATION_OUTCOME, 'Reporting-duration evaluation'],
    [process.env.REPORT_HISTORY_OUTCOME, 'Timing-history upload'],
  ];
  for (const [outcome, label] of reportChecks) {
    if (failedOutcome(outcome)) {
      addInfrastructureIssue(`${label} finished with status \`${outcome}\`.`);
    }
  }
  if (failedOutcome(process.env.REPORT_COVERAGE_OUTCOME)) {
    if (coverage) {
      addInfrastructureIssue(
        `Playwright coverage validation found ${coverage.missingTestIds?.length ?? 0} missing, ` +
        `${coverage.unexpectedTestIds?.length ?? 0} unexpected, ` +
        `${coverage.duplicatePlanTestIds?.length ?? 0} duplicate-plan, and ` +
        `${coverage.duplicateExecutionTestIds?.length ?? 0} duplicate-execution test ID(s).`
      );
    } else {
      addInfrastructureIssue(
        `Playwright coverage validation finished with status \`${process.env.REPORT_COVERAGE_OUTCOME}\`.`
      );
    }
  }

  let expectedShards = [];
  try {
    const matrix = JSON.parse(process.env.EXPECTED_MATRIX || '{}');
    expectedShards = (matrix.include || []).map(entry => String(entry.shardId));
    if (expectedShards.length === 0) {
      addInfrastructureIssue('No expected Playwright shards were declared.');
    }
  } catch (error) {
    addInfrastructureIssue(`The expected shard matrix was invalid: ${error.message}`);
  }

  const shardResults = [];
  const resultsDir = 'results';
  if (fs.existsSync(resultsDir)) {
    for (const dir of fs.readdirSync(resultsDir).sort()) {
      const jsonPath = path.join(resultsDir, dir, 'results.json');
      if (!fs.existsSync(jsonPath)) continue;

      const shardNum = dir.replace('playwright-results-json-', '');
      let report;
      try {
        report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      } catch (error) {
        addInfrastructureIssue(`Shard ${shardNum} uploaded invalid results JSON: ${error.message}`);
        continue;
      }

      const allTests = [];
      const lifecycleTests = [];
      function collectTests(suite, filePath) {
        const file = suite.file || filePath || '';
        for (const spec of (suite.specs || [])) {
          const specFile = spec.file || file;
          for (const test of (spec.tests || [])) {
            const results = test.results || [];
            const lastResult = results[results.length - 1] || {};
            const firstResult = results[0] || {};
            const testResult = {
              title: spec.title,
              file: specFile,
              status: test.status,
              retries: results.length - 1,
              error: lastResult.error?.message || firstResult.error?.message || '',
            };
            if (specFile.endsWith('.setup.ts') || specFile.endsWith('.teardown.ts')) {
              lifecycleTests.push(testResult);
            } else {
              allTests.push(testResult);
            }
          }
        }
        for (const child of (suite.suites || [])) {
          collectTests(child, file);
        }
      }
      for (const suite of (report.suites || [])) {
        collectTests(suite, '');
      }

      const knownStatuses = new Set(['expected', 'unexpected', 'flaky', 'skipped']);
      const unknownStatuses = allTests.filter(test => !knownStatuses.has(test.status));
      const unknownLifecycleStatuses = lifecycleTests.filter(
        test => !knownStatuses.has(test.status)
      );
      const lifecycleFailures = lifecycleTests.filter(
        test => test.status === 'unexpected'
      );
      const lifecycleFlaky = lifecycleTests.filter(
        test => test.status === 'flaky'
      );
      if (allTests.length === 0) {
        addInfrastructureIssue(`Shard ${shardNum} reported zero tests.`);
      }
      if (unknownStatuses.length > 0) {
        addInfrastructureIssue(`Shard ${shardNum} reported ${unknownStatuses.length} test(s) with an unknown status.`);
      }
      if (unknownLifecycleStatuses.length > 0) {
        addInfrastructureIssue(`Shard ${shardNum} reported ${unknownLifecycleStatuses.length} lifecycle test(s) with an unknown status.`);
      }
      for (const failure of lifecycleFailures) {
        addInfrastructureIssue(
          `Shard ${shardNum} failed in Playwright lifecycle test \`${failure.file} › ${failure.title}\`.`
        );
      }
      shardResults.push({
        shard: shardNum,
        genuine: allTests.filter(t => t.status === 'unexpected'),
        flaky: allTests.filter(t => t.status === 'flaky'),
        passed: allTests.filter(t => t.status === 'expected'),
        skipped: allTests.filter(t => t.status === 'skipped'),
        lifecycleFailures,
        lifecycleFlaky,
      });
    }
  }

  const resultsByShard = new Map(shardResults.map(result => [result.shard, result]));
  for (const shard of expectedShards) {
    if (!resultsByShard.has(shard)) {
      addInfrastructureIssue(`Shard ${shard} did not upload a usable Playwright results artifact.`);
    }
  }
  for (const shard of resultsByShard.keys()) {
    if (!expectedShards.includes(shard)) {
      addInfrastructureIssue(`Unexpected shard ${shard} uploaded Playwright results.`);
    }
  }

  const statusByShard = new Map();
  if (fs.existsSync(resultsDir)) {
    for (const dir of fs.readdirSync(resultsDir).sort()) {
      const statusPath = path.join(resultsDir, dir, 'ci-status.json');
      if (!fs.existsSync(statusPath)) continue;
      const shardNum = dir.replace('playwright-results-json-', '');
      try {
        const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
        statusByShard.set(shardNum, status);
      } catch (error) {
        addInfrastructureIssue(`Shard ${shardNum} uploaded invalid execution status JSON: ${error.message}`);
      }
    }
  }

  for (const shard of expectedShards) {
    const status = statusByShard.get(shard);
    if (!status) {
      addInfrastructureIssue(`Shard ${shard} did not upload its execution status.`);
      continue;
    }

    const steps = status.steps || {};
    const setupFailure = Object.entries(steps).find(
      ([name, outcome]) => name !== 'tests' && ['failure', 'cancelled'].includes(outcome)
    );
    if (setupFailure) {
      addInfrastructureIssue(`Shard ${shard} failed during \`${setupFailure[0]}\` setup.`);
    }

    const shardResult = resultsByShard.get(shard);
    const genuineFailures = shardResult?.genuine.length || 0;
    const lifecycleFailures = shardResult?.lifecycleFailures.length || 0;
    if (
      steps.tests !== 'success' &&
      !(steps.tests === 'failure' && (genuineFailures > 0 || lifecycleFailures > 0))
    ) {
      addInfrastructureIssue(`Shard ${shard} test execution finished with status \`${steps.tests || 'not-run'}\` without a reported test failure.`);
    }
  }

  const totalPassed = shardResults.reduce((s, r) => s + r.passed.length, 0);
  const totalFailed = shardResults.reduce((s, r) => s + r.genuine.length, 0);
  const totalFlaky = shardResults.reduce((s, r) => s + r.flaky.length, 0);
  const totalSkipped = shardResults.reduce((s, r) => s + r.skipped.length, 0);
  const totalLifecycleFlaky = shardResults.reduce(
    (sum, result) => sum + result.lifecycleFlaky.length,
    0
  );
  const zeroAttemptSkippedTests = coverage?.zeroAttemptSkippedTests ?? [];
  if (upstreamResult === 'failure' && totalFailed === 0 && infrastructureIssues.length === 0) {
    addInfrastructureIssue('The Playwright shard matrix failed outside a reported test failure.');
  }

  const lines = [commentMarker];

  if (totalFailed > 0 || infrastructureIssues.length > 0) {
    const testFailureText = totalFailed > 0 ? `${totalFailed} test failure(s)` : '';
    const infrastructureText = infrastructureIssues.length > 0 ? `${infrastructureIssues.length} CI/reporting failure(s)` : '';
    lines.push(`## 🔴 Playwright Results — ${[testFailureText, infrastructureText].filter(Boolean).join(', ')}`);
  } else if (totalFlaky > 0 || totalLifecycleFlaky > 0) {
    lines.push(
      `## 🟡 Playwright Results — all passed (${totalFlaky} product flaky, ` +
      `${totalLifecycleFlaky} lifecycle flaky)`
    );
  } else {
    lines.push(`## ✅ Playwright Results — all ${totalPassed} tests passed`);
  }
  lines.push('');
  const zeroAttemptSkippedText = zeroAttemptSkippedTests.length > 0
    ? ` (${zeroAttemptSkippedTests.length} zero-attempt; reason unknown)`
    : '';
  lines.push(
    `✅ ${totalPassed} passed · ❌ ${totalFailed} failed · ` +
    `🟡 ${totalFlaky} flaky · ⏭️ ${totalSkipped} skipped${zeroAttemptSkippedText} · ` +
    `🧰 ${totalLifecycleFlaky} lifecycle flaky`
  );
  lines.push('');

  if (infrastructureIssues.length > 0) {
    lines.push('### CI and reporting failures');
    lines.push('');
    for (const issue of infrastructureIssues) lines.push(`- ${issue}`);
    lines.push('');
  }

  if (zeroAttemptSkippedTests.length > 0) {
    lines.push('### Zero-attempt skipped tests');
    lines.push('');
    lines.push(
      `${zeroAttemptSkippedTests.length} planned test(s) were reported by Playwright as skipped with no attempts. ` +
      'They are accounted for by coverage; the native report does not provide a reliable reason.'
    );
    lines.push('');
    const zeroAttemptSkipGroups = new Map();
    for (const test of zeroAttemptSkippedTests) {
      const key = `${test.project || 'unknown'} · ${test.file || 'unknown file'}`;
      zeroAttemptSkipGroups.set(key, (zeroAttemptSkipGroups.get(key) ?? 0) + 1);
    }
    for (const [group, count] of zeroAttemptSkipGroups) {
      lines.push(`- ${group}: ${count} (reason: unknown)`);
    }
    lines.push('');
  }

  if (performance) {
    const performanceRows = [
      {
        classification: 'Blocking',
        metric: 'Environment setup',
        observed: `${displayMetric(performanceMetrics.maxEnvironmentSeconds)} s`,
        target: '≤ 300 s',
        passed: performanceTargets.environmentAtMostFiveMinutes,
      },
      {
        classification: 'Blocking',
        metric: 'Maximum shard execution',
        observed: `${displayMetric(performanceMetrics.maxExecutionSeconds)} s`,
        target: '≤ 1,260 s',
        passed: performanceTargets.executionAtMostTwentyOneMinutes,
      },
      {
        classification: 'Blocking',
        metric: 'Maximum shard-job elapsed before upload',
        observed: `${displayMetric(performanceMetrics.maxElapsedBeforeUploadSeconds)} s`,
        target: '≤ 1,800 s',
        passed: performanceTargets.shardsAtMostThirtyMinutesBeforeUpload,
      },
      {
        classification: 'Blocking',
        metric: 'Reporting and upload',
        observed: `${displayMetric(performanceMetrics.reportingSeconds)} s`,
        target: '≤ 120 s',
        passed: performanceTargets.reportingAtMostTwoMinutes,
      },
      {
        classification: 'Blocking',
        metric: 'Flaky test rate',
        observed: `${displayMetric(performanceMetrics.flakyRatePercent)}%`,
        target: '≤ 0.5%',
        passed: performanceTargets.flakyRateAtMostPointFivePercent,
      },
      {
        classification: 'Blocking',
        metric: 'Retry worker time',
        observed: `${displayMetric(performanceMetrics.retryWorkerPercent)}%`,
        target: '≤ 2%',
        passed: performanceTargets.retryWorkerTimeAtMostTwoPercent,
      },
      {
        classification: 'Blocking',
        metric: 'Static requests per app boot',
        observed: String(
          displayMetric(performanceMetrics.staticRequestsPerAppBoot)
        ),
        target: '< 100',
        passed: performanceTargets.staticRequestsPerAppBootBelowOneHundred,
      },
      {
        classification: 'Blocking',
        metric: 'App-boot measurement integrity',
        observed:
          `${displayMetric(performanceMetrics.appBoots)} boots / ` +
          `${displayMetric(performanceMetrics.uiScenarios)} scenarios / ` +
          `${displayMetric(performanceMetrics.appEntryRequests)} entry requests`,
        target: 'Complete',
        passed: performanceTargets.appBootMeasurementIntegrity,
      },
      {
        classification: 'Observation',
        metric: 'Full workflow signal wall (to summary)',
        observed: `${displayMetric(performanceMetrics.workflowWallSeconds)} s`,
        target: 'Reported',
        status: 'ℹ️',
      },
      {
        classification: 'Convergence',
        metric: 'Requests per attempt',
        observed: String(displayMetric(performanceMetrics.requestsPerAttempt)),
        target: '< 200',
        passed: convergenceTargets.requestsPerAttemptBelowTwoHundred,
      },
      {
        classification: 'Convergence',
        metric: 'App boots per UI scenario',
        observed:
          `${displayMetric(performanceMetrics.appBootsPerUIScenario)} ` +
          `(${displayMetric(performanceMetrics.appBoots)} / ` +
          `${displayMetric(performanceMetrics.uiScenarios)})`,
        target: '≤ 1',
        passed: convergenceTargets.atMostOneAppBootPerUIScenario,
      },
      {
        classification: 'Convergence',
        metric: 'Common shard skew',
        observed: `${displayMetric(performanceMetrics.commonShardSkewPercent)}%`,
        target: '≤ 15%',
        passed: convergenceTargets.commonShardSkewAtMostFifteenPercent,
      },
    ];
    lines.push('### Performance targets');
    lines.push('');
    lines.push(
      'Blocking targets enforce CI. Convergence targets remain measured and visible while the suite is optimized.'
    );
    lines.push('');
    lines.push('| Class | Metric | Observed | Target | Status |');
    lines.push('|-------|--------|----------|--------|--------|');
    for (const row of performanceRows) {
      const status = row.status ?? (row.passed === true
        ? '✅'
        : row.classification === 'Blocking'
        ? '❌'
        : '⚠️');
      lines.push(
        `| ${row.classification} | ${row.metric} | ${row.observed} | ${row.target} | ${status} |`
      );
    }
    lines.push('');
  }

  if (convergenceWarnings.length > 0) {
    lines.push('### Performance convergence warnings');
    lines.push('');
    for (const warning of convergenceWarnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

  lines.push('| Shard | Passed | Failed | Flaky | Skipped | Lifecycle flaky |');
  lines.push('|-------|--------|--------|-------|---------|-----------------|');
  for (const shard of expectedShards) {
    const r = resultsByShard.get(shard);
    if (!r) {
      lines.push(`| ⛔ Shard ${shard} | — | — | — | — | — |`);
      continue;
    }
    const status = r.genuine.length > 0 || r.lifecycleFailures.length > 0
      ? '🔴'
      : r.flaky.length > 0 || r.lifecycleFlaky.length > 0
      ? '🟡'
      : '✅';
    lines.push(`| ${status} Shard ${r.shard} | ${r.passed.length} | ${r.genuine.length} | ${r.flaky.length} | ${r.skipped.length} | ${r.lifecycleFlaky.length} |`);
  }
  lines.push('');

  const allGenuine = shardResults.flatMap(r => r.genuine.map(t => ({ ...t, shard: r.shard })));
  if (allGenuine.length > 0) {
    lines.push('### Genuine Failures (failed on all attempts)');
    lines.push('');
    for (const t of allGenuine.slice(0, 30)) {
      const shortFile = t.file.replace(/.*playwright\/e2e\//, '');
      lines.push(`<details><summary>❌ <code>${shortFile}</code> › ${t.title} (shard ${t.shard})</summary>`);
      lines.push('');
      lines.push('```');
      lines.push(t.error.substring(0, 1000));
      lines.push('```');
      lines.push('</details>');
      lines.push('');
    }
    if (allGenuine.length > 30) {
      lines.push(`... and ${allGenuine.length - 30} more failures`);
      lines.push('');
    }
  }

  const allFlaky = shardResults.flatMap(r => r.flaky.map(t => ({ ...t, shard: r.shard })));
  if (allFlaky.length > 0) {
    lines.push(`<details><summary>🟡 ${allFlaky.length} flaky test(s) (passed on retry)</summary>`);
    lines.push('');
    for (const t of allFlaky.slice(0, 30)) {
      const shortFile = t.file.replace(/.*playwright\/e2e\//, '');
      lines.push(`- \`${shortFile}\` › ${t.title} (shard ${t.shard}, ${t.retries} ${t.retries === 1 ? 'retry' : 'retries'})`);
    }
    if (allFlaky.length > 30) {
      lines.push(`- ... and ${allFlaky.length - 30} more`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  const allLifecycleFlaky = shardResults.flatMap(r =>
    r.lifecycleFlaky.map(test => ({ ...test, shard: r.shard }))
  );
  if (allLifecycleFlaky.length > 0) {
    lines.push(`<details><summary>🧰 ${allLifecycleFlaky.length} flaky lifecycle test(s) (passed on retry)</summary>`);
    lines.push('');
    for (const test of allLifecycleFlaky.slice(0, 30)) {
      const shortFile = test.file.replace(/.*playwright\/e2e\//, '');
      lines.push(`- \`${shortFile}\` › ${test.title} (shard ${test.shard}, ${test.retries} ${test.retries === 1 ? 'retry' : 'retries'})`);
    }
    if (allLifecycleFlaky.length > 30) {
      lines.push(`- ... and ${allLifecycleFlaky.length - 30} more`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  lines.push(`📦 [Download artifacts](${artifactUrl})`);
  lines.push('');
  lines.push('<details><summary>How to debug locally</summary>');
  lines.push('');
  lines.push('```bash');
  lines.push('# Download playwright-test-results-<shard> artifact and unzip');
  lines.push('npx playwright show-trace path/to/trace.zip    # view trace');
  lines.push('```');
  lines.push('</details>');

  const body = lines.join('\n');
  const boundedString = (value, maximumLength) =>
    String(value ?? '')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '�')
      .slice(0, maximumLength);
  const payloadShards = expectedShards.map(shard => {
    const result = resultsByShard.get(shard);
    return {
      id: boundedString(shard, 64),
      expected: true,
      present: Boolean(result),
      passed: result?.passed.length ?? 0,
      failed: result?.genuine.length ?? 0,
      flaky: result?.flaky.length ?? 0,
      skipped: result?.skipped.length ?? 0,
      lifecycleFailed: result?.lifecycleFailures.length ?? 0,
      lifecycleFlaky: result?.lifecycleFlaky.length ?? 0,
    };
  });
  for (const result of shardResults) {
    if (!expectedShards.includes(result.shard)) {
      payloadShards.push({
        id: boundedString(result.shard, 64),
        expected: false,
        present: true,
        passed: result.passed.length,
        failed: result.genuine.length,
        flaky: result.flaky.length,
        skipped: result.skipped.length,
        lifecycleFailed: result.lifecycleFailures.length,
        lifecycleFlaky: result.lifecycleFlaky.length,
      });
    }
  }
  if (payloadShards.length > 256) {
    throw new Error(`Refusing to publish ${payloadShards.length} shard records.`);
  }
  if (infrastructureIssues.length > 1024) {
    throw new Error(`Refusing to publish ${infrastructureIssues.length} infrastructure issues.`);
  }

  const performancePayloadMetrics = {
    maxEnvironmentSeconds: finiteMetric(performanceMetrics.maxEnvironmentSeconds),
    maxExecutionSeconds: finiteMetric(performanceMetrics.maxExecutionSeconds),
    maxElapsedBeforeUploadSeconds: finiteMetric(
      performanceMetrics.maxElapsedBeforeUploadSeconds
    ),
    reportingSeconds: finiteMetric(performanceMetrics.reportingSeconds),
    workflowWallSeconds: finiteMetric(performanceMetrics.workflowWallSeconds),
    requestsPerAttempt: finiteMetric(performanceMetrics.requestsPerAttempt),
    appBootsPerUIScenario: finiteMetric(
      performanceMetrics.appBootsPerUIScenario
    ),
    commonShardSkewPercent: finiteMetric(
      performanceMetrics.commonShardSkewPercent
    ),
  };
  const hasCompletePerformancePayload = Object.values(
    performancePayloadMetrics
  ).every(value => value !== null);
  const performancePayload = performance && hasCompletePerformancePayload
    ? {
        blockingTargetsMet: performance.blockingTargetsMet === true,
        convergenceTargetsMet: performance.convergenceTargetsMet === true,
        metrics: performancePayloadMetrics,
        convergenceWarnings: convergenceWarnings.map(warning =>
          boundedString(warning, 300)
        ),
      }
    : null;
  const commentPayload = {
    version: 2,
    totals: {
      passed: totalPassed,
      failed: totalFailed,
      flaky: totalFlaky,
      skipped: totalSkipped,
      zeroAttemptSkipped: zeroAttemptSkippedTests.length,
      lifecycleFlaky: totalLifecycleFlaky,
    },
    shards: payloadShards,
    infrastructureIssueCount: infrastructureIssues.length,
    infrastructureIssues: infrastructureIssues
      .slice(0, 100)
      .map(issue => boundedString(issue, 500)),
    failures: allGenuine.slice(0, 30).map(test => ({
      shard: boundedString(test.shard, 64),
      file: boundedString(test.file, 300),
      title: boundedString(test.title, 300),
      error: boundedString(test.error, 1000),
    })),
    flakyTests: allFlaky.slice(0, 30).map(test => ({
      shard: boundedString(test.shard, 64),
      file: boundedString(test.file, 300),
      title: boundedString(test.title, 300),
      retries: Math.max(0, test.retries),
    })),
    lifecycleFlakyTests: allLifecycleFlaky.slice(0, 30).map(test => ({
      shard: boundedString(test.shard, 64),
      file: boundedString(test.file, 300),
      title: boundedString(test.title, 300),
      retries: Math.max(0, test.retries),
    })),
    performance: performancePayload,
  };
  const commentPayloadPath = process.env.COMMENT_PAYLOAD_PATH;
  const serializedCommentPayload = `${JSON.stringify(commentPayload, null, 2)}\n`;
  if (Buffer.byteLength(serializedCommentPayload, 'utf8') > 262144) {
    throw new Error('The Playwright comment payload exceeds 256 KiB.');
  }

  fs.mkdirSync(path.dirname(commentPayloadPath), { recursive: true });
  fs.writeFileSync(commentPayloadPath, serializedCommentPayload, 'utf8');

  try {
    await core.summary.addRaw(body).write();
  } catch (error) {
    core.warning(`Could not write the Playwright job summary: ${error.message}`);
  }

  if (totalFailed > 0 || infrastructureIssues.length > 0) {
    core.setFailed(
      `${totalFailed} Playwright test failure(s); ${infrastructureIssues.length} CI/reporting failure(s).`
    );
  }
}

module.exports = { renderPlaywrightSummary };
