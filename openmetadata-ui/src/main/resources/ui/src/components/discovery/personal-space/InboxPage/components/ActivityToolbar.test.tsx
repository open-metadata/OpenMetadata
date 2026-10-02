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
import { ReactNode } from 'react';
import { ActivityFilter, ActivityGrouping, InboxCount } from '../inbox.utils';
import ActivityToolbar from './ActivityToolbar';

interface MockOption {
  value: string;
  label: ReactNode;
}

jest.mock('@openmetadata/ui-core-components', () => {
  const Tabs = ({
    children,
    onSelectionChange,
  }: {
    children?: ReactNode;
    onSelectionChange: (key: string) => void;
  }) => (
    <div>
      {children}
      <button onClick={() => onSelectionChange('mentions')}>
        pick-mentions
      </button>
    </div>
  );
  Tabs.List = ({ children }: { children?: ReactNode }) => <>{children}</>;
  Tabs.Item = ({
    id,
    children,
  }: {
    id: string;
    children: (state: { isSelected: boolean }) => ReactNode;
  }) => (
    <span data-testid={`tab-${id}`}>
      {children({ isSelected: id === 'all' })}
    </span>
  );

  return {
    Badge: ({ children, color }: { children?: ReactNode; color?: string }) => (
      <span data-color={color} data-testid="tab-count">
        {children}
      </span>
    ),
    Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Tabs,
    FilterSelect: ({
      options,
      onChange,
      ...props
    }: {
      options: MockOption[];
      onChange: (values: string[]) => void;
      'data-testid': string;
    }) => (
      <div data-testid={props['data-testid']}>
        {options.map(({ value, label }) => (
          <button key={value} onClick={() => onChange([value])}>
            {label}
          </button>
        ))}
        <button onClick={() => onChange([])}>clear</button>
      </div>
    ),
  };
});

// Exercised by its own suite; here it lists its options and reports picks.
jest.mock('./ActivityToolbarMenu', () => ({
  __esModule: true,
  default: ({
    options,
    triggerLabel,
    onChange,
    ...props
  }: {
    options: MockOption[];
    triggerLabel?: string;
    onChange: (value: string) => void;
    'data-testid': string;
  }) => (
    <div data-testid={props['data-testid']}>
      <span data-testid={`${props['data-testid']}-trigger`}>
        {triggerLabel}
      </span>
      {options.map(({ value, label }) => (
        <button key={value} onClick={() => onChange(value)}>
          {label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const exact = (total: number): InboxCount => ({ total, isCapped: false });

const renderToolbar = (
  counts?: Partial<Record<ActivityFilter, InboxCount>>
) => {
  const props = {
    counts,
    datePreset: 'last30days',
    filter: ActivityFilter.All,
    grouping: ActivityGrouping.Day,
    typeKeys: [],
    onDatePresetChange: jest.fn(),
    onFilterChange: jest.fn(),
    onGroupingChange: jest.fn(),
    onTypeKeysChange: jest.fn(),
  };
  render(<ActivityToolbar {...props} />);

  return props;
};

describe('ActivityToolbar', () => {
  it('offers every sub-tab and reports the one picked', () => {
    const { onFilterChange } = renderToolbar();

    ['label.all', 'label.mention-plural', 'label.my-asset-plural'].forEach(
      (label) => expect(screen.getByText(label)).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText('pick-mentions'));

    expect(onFilterChange).toHaveBeenCalledWith(ActivityFilter.Mentions);
  });

  // Zero reads as no badge; the chosen tab's count is brand-tinted.
  it('badges each sub-tab with its count', () => {
    renderToolbar({
      [ActivityFilter.All]: exact(3),
      [ActivityFilter.Mentions]: exact(1),
      [ActivityFilter.Following]: exact(0),
    });

    expect(screen.getByTestId('tab-all')).toHaveTextContent('label.all3');
    expect(screen.getByTestId('tab-mentions')).toHaveTextContent(
      'label.mention-plural1'
    );
    expect(screen.getByTestId('tab-following')).toHaveTextContent(
      /^label.following$/
    );
    expect(
      screen.getAllByTestId('tab-count').map((badge) => badge.dataset.color)
    ).toEqual(['brand', 'gray']);
  });

  // The lists are capped, so a full page reads as a floor.
  it('marks a capped count with a plus', () => {
    renderToolbar({ [ActivityFilter.All]: { total: 300, isCapped: true } });

    expect(screen.getByTestId('tab-all')).toHaveTextContent('label.all300+');
  });

  it('reads Group until a grouping is picked, with day groups as None', () => {
    const { onGroupingChange } = renderToolbar();

    expect(
      screen.getByTestId('activity-group-filter-trigger')
    ).toHaveTextContent('label.group');

    fireEvent.click(screen.getByText('label.user'));

    expect(onGroupingChange).toHaveBeenLastCalledWith(ActivityGrouping.User);

    fireEvent.click(screen.getByText('label.none'));

    expect(onGroupingChange).toHaveBeenLastCalledWith(ActivityGrouping.Day);
  });

  it('filters by the change types, with Other for the rest', () => {
    const { onTypeKeysChange } = renderToolbar();
    const types = screen.getByTestId('activity-type-filter');

    expect(types).toHaveTextContent('label.tag-plural');
    expect(types).toHaveTextContent('label.other');

    fireEvent.click(screen.getByText('label.owner-plural'));

    expect(onTypeKeysChange).toHaveBeenCalledWith(['label.owner-plural']);
  });

  it('offers the date presets up to 30 days and reports the one picked', () => {
    const { onDatePresetChange } = renderToolbar();
    const dates = screen.getByTestId('activity-date-filter');

    expect(dates).toHaveTextContent('label.yesterday');
    expect(dates).not.toHaveTextContent('60');

    fireEvent.click(screen.getByText('label.yesterday'));

    expect(onDatePresetChange).toHaveBeenCalledWith('yesterday');
  });
});
