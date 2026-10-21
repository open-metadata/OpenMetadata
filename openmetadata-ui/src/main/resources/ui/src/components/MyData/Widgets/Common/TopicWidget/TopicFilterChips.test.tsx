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
import userEvent from '@testing-library/user-event';
import TopicFilterChips, { TopicFilterChip } from './TopicFilterChips';

const CHIPS: TopicFilterChip[] = [
  { count: 30, id: 'all', label: 'All', tone: 'brand' },
  { count: 4, id: 'noOwner', label: 'No owner', tone: 'warning' },
  { count: 6, id: 'empty', label: 'Empty', tone: 'muted' },
];

const renderChips = (
  props: Partial<Parameters<typeof TopicFilterChips>[0]> = {}
) => {
  const onChange = jest.fn();
  render(
    <TopicFilterChips
      chips={CHIPS}
      label="Domains"
      testIdPrefix="domains"
      value="all"
      onChange={onChange}
      {...props}
    />
  );

  return { onChange };
};

describe('TopicFilterChips', () => {
  it('is one labelled single-choice group with the value checked', () => {
    renderChips();

    expect(screen.getByRole('radiogroup')).toHaveAccessibleName('Domains');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByTestId('domains-filter-all')).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByTestId('domains-filter-empty')).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('reports the chosen chip', () => {
    const { onChange } = renderChips();

    fireEvent.click(screen.getByTestId('domains-filter-noOwner'));

    expect(onChange).toHaveBeenCalledWith('noOwner');
  });

  // Domains and Data Products both offer the same chip ids on one page; an
  // unprefixed `topic-filter-all` matched two elements.
  it('namespaces every testid by the owning card', () => {
    renderChips({ testIdPrefix: 'data-products' });

    expect(
      screen.getByTestId('data-products-filter-chips')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('data-products-filter-empty-count')
    ).toHaveTextContent('6');
    expect(screen.queryByTestId('topic-filter-all')).toBeNull();
  });

  // `role="radio"` promises arrow-key movement; the hand-rolled buttons only
  // tabbed. react-aria's group moves focus between the options.
  it('moves focus between chips with the arrow keys', async () => {
    // Fake timers are on suite-wide; let user-event drive them.
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderChips();

    await user.tab();

    expect(screen.getByTestId('domains-filter-all')).toHaveFocus();

    await user.keyboard('{ArrowRight}');

    expect(screen.getByTestId('domains-filter-noOwner')).toHaveFocus();
  });
});
