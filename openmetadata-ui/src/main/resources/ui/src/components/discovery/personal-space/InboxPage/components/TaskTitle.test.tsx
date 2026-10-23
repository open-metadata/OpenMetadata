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
import TaskTitle from './TaskTitle';

describe('TaskTitle', () => {
  // The badge sits beside the clamped title, not inside it, so a wrapped
  // title never carries it onto a later line.
  it('sets the asset-type badge beside the title, on a line of its size', () => {
    render(
      <TaskTitle entityType="testCase" size="text-md" text="Approve orders">
        <span>Approve orders</span>
      </TaskTitle>
    );

    const title = screen.getByTestId('clamped-text');
    const badge = screen.getByTestId('task-title-entity-type');

    expect(title).toHaveClass('tw:max-w-3/4');
    expect(title).not.toContainElement(badge);
    expect(badge).toHaveTextContent('Test Case');
    expect(badge.parentElement).toHaveClass('tw:h-lh', 'tw:text-md');
  });

  it('shows the title alone when it names no asset', () => {
    render(
      <TaskTitle size="text-sm" text="Approve orders">
        <span>Approve orders</span>
      </TaskTitle>
    );

    expect(screen.getByText('Approve orders')).toBeInTheDocument();
    expect(
      screen.queryByTestId('task-title-entity-type')
    ).not.toBeInTheDocument();
  });
});
