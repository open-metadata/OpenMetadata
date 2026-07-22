/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import type {
  FullConfig,
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

type PerformanceReporterOptions = {
  outputFile?: string;
};

type TestTiming = {
  attempts: number;
  durationMs: number;
  file: string;
  id: string;
  leafTitle: string;
  outcome: string;
  project: string;
  retries: number;
  retryDurationMs: number;
  title: string;
};

class PerformanceReporter implements Reporter {
  private readonly outputFile: string;
  private rootDir = process.cwd();
  private readonly tests = new Map<string, TestTiming>();

  constructor(options: PerformanceReporterOptions = {}) {
    this.outputFile =
      options.outputFile ?? 'playwright/output/playwright-timings.json';
  }

  onBegin(config: FullConfig) {
    this.rootDir = config.rootDir;
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (
      test.location.file.endsWith('.setup.ts') ||
      test.location.file.endsWith('.teardown.ts')
    ) {
      return;
    }

    const existing = this.tests.get(test.id);
    const project = test.parent.project()?.name ?? '';
    const timing: TestTiming = existing ?? {
      attempts: 0,
      durationMs: 0,
      file: path.relative(this.rootDir, test.location.file),
      id: test.id,
      leafTitle: test.title,
      outcome: result.status,
      project,
      retries: 0,
      retryDurationMs: 0,
      title: test.titlePath().join(' › '),
    };

    timing.attempts += 1;
    timing.durationMs += result.duration;
    timing.outcome = test.outcome();
    timing.retries = Math.max(timing.retries, result.retry);
    if (result.retry > 0) {
      timing.retryDurationMs += result.duration;
    }
    this.tests.set(test.id, timing);
  }

  async onEnd(result: FullResult) {
    const outputPath = path.resolve(this.outputFile);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(
      outputPath,
      `${JSON.stringify(
        {
          version: 1,
          mode: process.env.PW_EXECUTION_MODE ?? 'local',
          shardId: process.env.PW_SHARD_ID ?? 'local',
          status: result.status,
          tests: [...this.tests.values()].sort((left, right) =>
            left.id.localeCompare(right.id)
          ),
        },
        null,
        2
      )}\n`
    );
  }
}

export default PerformanceReporter;
