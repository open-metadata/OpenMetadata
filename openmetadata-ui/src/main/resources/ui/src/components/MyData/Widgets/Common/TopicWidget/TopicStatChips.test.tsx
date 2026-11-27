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
import { fireEvent, render, screen } from '@testing-library/react';
import TopicStatChips from './TopicStatChips';

const STATS = [
  { id: 'failing', label: '3 failing', tone: 'critical' as const },
  { id: 'healthy', label: '12 healthy', tone: 'success' as const },
];

describe('TopicStatChips', () => {
  it('marks the selected bucket and reports a pick', () => {
    const onChange = jest.fn();
    render(
      <TopicStatChips
        label="Buckets"
        stats={STATS}
        value="failing"
        onChange={onChange}
      />
    );

    expect(screen.getByRole('group', { name: 'Buckets' })).toBeInTheDocument();
    expect(screen.getByTestId('topic-stat-failing')).toHaveTextContent(
      '3 failing'
    );
    expect(screen.getByTestId('topic-stat-failing')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('topic-stat-healthy')).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    fireEvent.click(screen.getByTestId('topic-stat-healthy'));

    expect(onChange).toHaveBeenCalledWith('healthy');
  });

  // An empty bucket has no list to show, so it cannot be picked.
  it('disables an empty bucket unless it is the one selected', () => {
    render(
      <TopicStatChips
        label="Buckets"
        stats={[
          {
            id: 'failing',
            isDisabled: true,
            label: '0 failing',
            tone: 'critical',
          },
          {
            id: 'not-run',
            isDisabled: true,
            label: '0 not run',
            tone: 'muted',
          },
        ]}
        value="failing"
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('topic-stat-not-run')).toBeDisabled();
    expect(screen.getByTestId('topic-stat-failing')).not.toBeDisabled();
  });
});
