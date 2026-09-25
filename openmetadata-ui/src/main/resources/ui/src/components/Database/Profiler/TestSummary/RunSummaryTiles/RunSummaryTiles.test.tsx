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
import { render, screen } from '@testing-library/react';
import { TestCaseStatus } from '../../../../../generated/tests/testCase';
import RunSummaryTiles from './RunSummaryTiles';

const runs = (...statuses: TestCaseStatus[]) =>
  statuses.map((testCaseStatus, i) => ({ timestamp: i, testCaseStatus }));

const tileValue = (key: string) =>
  screen.getByTestId(`run-summary-${key}`).querySelector('[data-value]')
    ?.textContent;

describe('RunSummaryTiles', () => {
  it('should count each outcome and rate only the completed runs', () => {
    render(
      <RunSummaryTiles
        results={runs(
          TestCaseStatus.Success,
          TestCaseStatus.Success,
          TestCaseStatus.Success,
          TestCaseStatus.Failed,
          TestCaseStatus.Aborted,
          TestCaseStatus.Queued
        )}
      />
    );

    expect(tileValue('runs')).toBe('6');
    expect(tileValue('passed')).toBe('3');
    expect(tileValue('failed')).toBe('1');
    expect(tileValue('aborted')).toBe('1');
    // 3 of the 5 completed runs: a queued run has no outcome to rate.
    expect(tileValue('success-rate')).toBe('60%');
  });

  // Runs counts every row, queued included, while the three outcome tiles do
  // not - so they are not meant to add up to it.
  it('should not make the outcome tiles sum to the run count', () => {
    render(
      <RunSummaryTiles
        results={runs(
          TestCaseStatus.Success,
          TestCaseStatus.Queued,
          TestCaseStatus.Queued
        )}
      />
    );

    expect(tileValue('runs')).toBe('3');
    expect(
      Number(tileValue('passed')) +
        Number(tileValue('failed')) +
        Number(tileValue('aborted'))
    ).toBe(1);
  });

  it('should show an em dash for the rate when every run is queued', () => {
    render(
      <RunSummaryTiles
        results={runs(TestCaseStatus.Queued, TestCaseStatus.Queued)}
      />
    );

    expect(tileValue('success-rate')).toBe('—');
  });

  it('should show zeros for an empty window', () => {
    render(<RunSummaryTiles results={[]} />);

    expect(tileValue('runs')).toBe('0');
    expect(tileValue('passed')).toBe('0');
    expect(tileValue('failed')).toBe('0');
    expect(tileValue('aborted')).toBe('0');
    expect(tileValue('success-rate')).toBe('—');
  });

  it('should round the rate to one decimal', () => {
    render(
      <RunSummaryTiles
        results={[
          ...runs(...Array(25).fill(TestCaseStatus.Success)),
          ...runs(...Array(5).fill(TestCaseStatus.Failed)),
        ]}
      />
    );

    expect(tileValue('success-rate')).toBe('83.3%');
  });
});
