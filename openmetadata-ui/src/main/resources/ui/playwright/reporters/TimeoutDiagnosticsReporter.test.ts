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
import { expect, test } from '@playwright/test';
import type { TestStep } from '@playwright/test/reporter';
import { findFailingStep } from './TimeoutDiagnosticsReporter';

const TEST_START = 1_000_000;
const DEADLINE = TEST_START + 60_000;

const step = (
  title: string,
  startOffset: number,
  duration: number,
  steps: TestStep[] = []
): TestStep =>
  ({
    title,
    category: 'pw:api',
    startTime: new Date(TEST_START + startOffset),
    duration,
    error: { message: `${title} failed` },
    steps,
  } as TestStep);

test('picks the step still running at the deadline over a deeper one that ended earlier', () => {
  // The shape of a real merge-queue timeout: storageStateRecovery's losing
  // boot-race watcher errors at 30s, two levels deep under "Before Hooks",
  // while the locator wait that actually hung the test sits at the top level.
  const steps = [
    {
      title: 'Before Hooks',
      category: 'hook',
      startTime: new Date(TEST_START),
      duration: 3_193,
      steps: [step('Wait for navigation', 0, 30_003)],
    } as TestStep,
    step("Wait for selector getByTestId('selectable-list')", 7_500, 52_486),
  ];

  expect(findFailingStep(steps, DEADLINE)?.title).toContain('selectable-list');
});

test('falls back to the deepest errored step when nothing was in flight', () => {
  const steps = [
    {
      title: 'Before Hooks',
      category: 'hook',
      startTime: new Date(TEST_START),
      duration: 3_193,
      steps: [step('Wait for navigation', 0, 30_003)],
    } as TestStep,
  ];

  expect(findFailingStep(steps, DEADLINE)?.title).toBe('Wait for navigation');
});
