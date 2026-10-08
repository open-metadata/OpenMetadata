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

describe('TopicStatChips', () => {
  it('renders one chip per stat and reports a press', () => {
    const onPress = jest.fn();
    render(
      <TopicStatChips
        stats={[
          { id: 'failing', label: '3 failing', onPress, tone: 'critical' },
          { id: 'healthy', label: '12 healthy', onPress, tone: 'success' },
        ]}
      />
    );

    expect(screen.getByTestId('topic-stat-failing')).toHaveTextContent(
      '3 failing'
    );

    fireEvent.click(screen.getByTestId('topic-stat-failing'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // An empty bucket is not worth a click, so a stat with no handler is inert.
  it('disables a chip that has nothing to open', () => {
    render(
      <TopicStatChips
        stats={[{ id: 'not-run', label: '0 not run', tone: 'muted' }]}
      />
    );

    expect(screen.getByTestId('topic-stat-not-run')).toBeDisabled();
  });
});
