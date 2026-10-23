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

let mockFirstLineEnd: number | undefined;

// Layout is the hook's job; here the line has ended where the test says.
jest.mock('../../../../../hooks/useFirstLineEnd', () => ({
  useFirstLineEnd: () => ({ ref: { current: null }, end: mockFirstLineEnd }),
}));

describe('TaskTitle', () => {
  beforeEach(() => {
    mockFirstLineEnd = 180;
  });

  // The badge sits outside the clamped title, after its first line's last
  // word, so a wrapped title never carries it onto a later line.
  it('sets the badge where the first line ends, on a line of its size', () => {
    render(
      <TaskTitle entityType="testCase" size="text-md" text="Approve orders">
        <span>Approve orders</span>
      </TaskTitle>
    );

    const title = screen.getByTestId('clamped-text');
    const slot = screen.getByTestId('task-title-badge-slot');

    expect(title.parentElement).toHaveClass('tw:max-w-3/4');
    expect(title).not.toContainElement(slot);
    expect(slot).toHaveStyle({ left: '180px' });
    expect(slot).toHaveClass('tw:h-lh', 'tw:text-md');
    expect(screen.getByTestId('task-title-entity-type')).toHaveTextContent(
      'Test Case'
    );
  });

  it('keeps the badge at the title edge until the line is measured', () => {
    mockFirstLineEnd = undefined;
    render(
      <TaskTitle entityType="table" size="text-sm" text="Approve orders">
        <span>Approve orders</span>
      </TaskTitle>
    );

    expect(screen.getByTestId('task-title-badge-slot')).toHaveClass(
      'tw:left-3/4'
    );
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
