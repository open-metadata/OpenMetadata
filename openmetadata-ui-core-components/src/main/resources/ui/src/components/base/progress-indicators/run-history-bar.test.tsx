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
import { describe, expect, it } from 'vitest';
import { RunHistoryBar, RunHistoryItem } from './run-history-bar';

const statuses = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-status]')).map((bar) =>
    bar.getAttribute('data-status')
  );

describe('RunHistoryBar', () => {
  it('is one labelled image, not a row of focusable bars', () => {
    render(
      <RunHistoryBar
        ariaLabel="Last 2 runs: 1 successful, 1 failed"
        runs={[
          { status: 'success', label: 'Run 1 · Successful' },
          { status: 'failed', label: 'Run 2 · Failed' },
        ]}
      />
    );

    expect(
      screen.getByRole('img', { name: 'Last 2 runs: 1 successful, 1 failed' })
    ).toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('pads missing runs on the left so strips align run-for-run', () => {
    const { container } = render(
      <RunHistoryBar
        ariaLabel="runs"
        max={4}
        runs={[{ status: 'success' }, { status: 'pending' }]}
      />
    );

    expect(statuses(container)).toEqual([
      'empty',
      'empty',
      'success',
      'pending',
    ]);
  });

  it('keeps only the newest runs when there are more than slots', () => {
    const runs: RunHistoryItem[] = [
      { id: 'a', status: 'failed' },
      { id: 'b', status: 'skipped' },
      { id: 'c', status: 'running' },
      { id: 'd', status: 'success' },
    ];
    const { container } = render(
      <RunHistoryBar ariaLabel="runs" max={2} runs={runs} />
    );

    expect(statuses(container)).toEqual(['running', 'success']);
  });

  it('forwards the test id to the strip', () => {
    render(<RunHistoryBar ariaLabel="runs" data-testid="strip" runs={[]} />);

    expect(screen.getByTestId('strip')).toHaveAttribute('role', 'img');
  });
});
