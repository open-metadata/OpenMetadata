/*
 *  Copyright 2026 Collate.
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
  Reporter,
  TestCase,
  TestError,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';

/**
 * Put the failing step back into a timed-out test's error message.
 *
 * A test that exhausts its timeout reports exactly one error —
 * `Test timeout of 60000ms exceeded.` — with no file, line, locator or call log,
 * and the `json` reporter serialises a timed-out result with `steps: []`. That is
 * the artifact the merge-queue tooling reads, so the majority of merge-queue
 * flakes arrive undiagnosable: the only way to find out what actually hung is to
 * download the multi-megabyte blob artifact and parse `report.jsonl` by hand.
 * Nobody does that, which is why flakes get retried rather than fixed.
 *
 * The information exists in-process on `TestResult.steps`; it is only lost at the
 * reporter boundary. This reporter finds the innermost step that was still in
 * flight when the clock ran out and prepends its title, source location and
 * Playwright call log to the result's error.
 *
 * Ordering matters: Playwright hands the same `TestResult` object to each
 * reporter in the order they are configured, so this must be listed **before**
 * `json`/`blob`/`html` for them to serialise the enriched message.
 */
class TimeoutDiagnosticsReporter implements Reporter {
  onTestEnd(_test: TestCase, result: TestResult): void {
    if (result.status !== 'timedOut') {
      return;
    }

    const diagnosis = describeFailingStep(result.steps);

    if (!diagnosis) {
      return;
    }

    const prefix = `${diagnosis}\n\n`;
    const [first] = result.errors;

    if (first) {
      applyPrefix(first, prefix);
    } else {
      result.errors.push({ message: prefix.trim() });
    }

    if (result.error && result.error !== first) {
      applyPrefix(result.error, prefix);
    }
  }
}

const applyPrefix = (error: TestError, prefix: string): void => {
  if (error.message?.startsWith(TIMEOUT_DIAGNOSIS_MARKER)) {
    return;
  }

  error.message = `${prefix}${error.message ?? ''}`;

  if (error.stack) {
    error.stack = `${prefix}${error.stack}`;
  }
};

const TIMEOUT_DIAGNOSIS_MARKER = 'Timed out in step:';

/**
 * The innermost errored step is the most specific description of where the test
 * stopped: at timeout Playwright fails every step still on the stack, so the
 * chain runs from `test.step(...)` down to the individual `locator.click` that
 * never resolved. Depth wins; duration breaks ties between siblings, since the
 * one that consumed the clock is the one that hung.
 */
export const findFailingStep = (steps: TestStep[]): TestStep | undefined => {
  let best: { step: TestStep; depth: number } | undefined;

  const visit = (candidates: TestStep[], depth: number): void => {
    for (const step of candidates) {
      if (step.error) {
        const isBetter =
          !best ||
          depth > best.depth ||
          (depth === best.depth && step.duration > best.step.duration);

        if (isBetter) {
          best = { step, depth };
        }
      }
      visit(step.steps ?? [], depth + 1);
    }
  };

  visit(steps, 0);

  return best?.step;
};

export const describeFailingStep = (steps: TestStep[]): string | undefined => {
  const step = findFailingStep(steps);

  if (!step) {
    return undefined;
  }

  const lines = [
    `${TIMEOUT_DIAGNOSIS_MARKER} ${step.title} (${step.duration}ms, category "${step.category}")`,
  ];

  if (step.location) {
    lines.push(
      `  at ${step.location.file}:${step.location.line}:${step.location.column}`
    );
  }

  const callLog = extractCallLog(step.error?.message);

  if (callLog) {
    lines.push(callLog);
  }

  return lines.join('\n');
};

/**
 * Keep Playwright's own call log ("waiting for …", "element was detached from
 * the DOM") and drop the `Test timeout of Nms exceeded` line the outer error
 * already carries.
 */
const extractCallLog = (message?: string): string | undefined => {
  if (!message) {
    return undefined;
  }

  const kept = message
    .split('\n')
    .filter(
      (line) =>
        !/^\s*(Error: )?.*Test timeout of \d+ms exceeded\.?\s*$/.test(line)
    )
    .filter((line) => line.trim().length > 0);

  return kept.length > 0 ? kept.join('\n') : undefined;
};

export default TimeoutDiagnosticsReporter;
