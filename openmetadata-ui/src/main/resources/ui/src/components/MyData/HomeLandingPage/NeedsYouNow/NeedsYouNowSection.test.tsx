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

import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { NeedsYouNowItem } from './needsYouNow.types';
import NeedsYouNowSection from './NeedsYouNowSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  );

  interface MockTabProps {
    id: string;
    label: string;
    badge?: number;
  }

  const Tabs = ({
    children,
    onSelectionChange,
  }: {
    children?: React.ReactNode;
    onSelectionChange?: (key: string) => void;
  }) => (
    <div data-testid="tabs">
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{ onSelect?: (k: string) => void }>,
              { onSelect: onSelectionChange }
            )
          : child
      )}
    </div>
  );
  Tabs.List = ({
    items,
    onSelect,
  }: {
    items: MockTabProps[];
    onSelect?: (key: string) => void;
  }) => (
    <div>
      {items.map((tab) => (
        <button
          data-testid={`tab-${tab.id}`}
          key={tab.id}
          onClick={() => onSelect?.(tab.id)}>
          {`${tab.label}:${tab.badge}`}
        </button>
      ))}
    </div>
  );
  Tabs.Item = Passthrough;
  Tabs.Panel = Passthrough;

  return {
    Avatar: ({ initials }: { initials?: string }) => <span>{initials}</span>,
    Button: ({
      children,
      onPress,
      'data-testid': dataTestId,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      'data-testid'?: string;
    }) => (
      <button data-testid={dataTestId} onClick={onPress}>
        {children}
      </button>
    ),
    Dot: () => <span />,
    Dropdown: {
      DotsButton: ({
        'data-testid': dataTestId,
      }: {
        'data-testid'?: string;
      }) => <button aria-label="more" data-testid={dataTestId} type="button" />,
      Item: () => null,
      Menu: Passthrough,
      Popover: Passthrough,
      Root: Passthrough,
    },
    Tabs,
    Typography: Passthrough,
  };
});

const ITEMS: NeedsYouNowItem[] = [
  {
    id: 'approval-1',
    kind: 'approval',
    ref: '#TASK-1',
    title: 'Approve access',
    summary: 'Waiting on you.',
    actor: 'harsha',
    age: '13 days ago',
  },
  {
    id: 'health-1',
    kind: 'health',
    ref: '15 services',
    title: 'Services stopped ingesting',
    summary: 'Ingestion failed.',
    actor: 'Ingestion service',
    age: '16 hours ago',
    actionLabel: 'View failing services',
  },
  {
    id: 'quality-1',
    kind: 'quality',
    ref: 'Redshift',
    title: 'Certification expired',
    summary: 'Gold badge lost.',
    actor: 'Governance',
    age: 'expired 24 Jun',
  },
];

const itemId = (id: string) => `needs-you-now-item-${id}`;
const LIST_TESTID = 'needs-you-now-list';
const ALL_TAB = 'tab-all';
const APPROVAL_TAB = 'tab-approval';
const APPROVE_LABEL = 'label.approve';
const APPROVAL_ITEM = itemId('approval-1');

describe('NeedsYouNowSection', () => {
  it('lists every item with the all tab selected', () => {
    render(<NeedsYouNowSection items={ITEMS} />);

    const list = screen.getByTestId(LIST_TESTID);

    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByTestId(ALL_TAB)).toHaveTextContent('label.all:3');
  });

  it('counts each stream separately in its tab', () => {
    render(<NeedsYouNowSection items={ITEMS} />);

    expect(screen.getByTestId(APPROVAL_TAB)).toHaveTextContent(
      'label.approval-plural:1'
    );
    expect(screen.getByTestId('tab-health')).toHaveTextContent(
      'label.health:1'
    );
    expect(screen.getByTestId('tab-quality')).toHaveTextContent(
      'label.quality:1'
    );
  });

  it('filters to a single stream when its tab is selected', () => {
    render(<NeedsYouNowSection items={ITEMS} />);

    fireEvent.click(screen.getByTestId(APPROVAL_TAB));

    expect(screen.getByTestId(APPROVAL_ITEM)).toBeInTheDocument();
    expect(screen.queryByTestId(itemId('health-1'))).not.toBeInTheDocument();
  });

  it('offers reject and approve on approvals, and the item action elsewhere', () => {
    render(<NeedsYouNowSection items={ITEMS} />);

    const approval = screen.getByTestId(APPROVAL_ITEM);

    expect(within(approval).getByText('label.reject')).toBeInTheDocument();
    expect(within(approval).getByText(APPROVE_LABEL)).toBeInTheDocument();

    const health = screen.getByTestId(itemId('health-1'));

    expect(
      within(health).getByText('View failing services')
    ).toBeInTheDocument();
    expect(within(health).queryByText(APPROVE_LABEL)).not.toBeInTheDocument();
  });

  it('drops a resolved item and decrements its tab count', () => {
    render(<NeedsYouNowSection items={ITEMS} />);

    fireEvent.click(
      within(screen.getByTestId(APPROVAL_ITEM)).getByText(APPROVE_LABEL)
    );

    expect(screen.queryByTestId(APPROVAL_ITEM)).not.toBeInTheDocument();
    expect(screen.getByTestId(ALL_TAB)).toHaveTextContent('label.all:2');
    expect(screen.getByTestId(APPROVAL_TAB)).toHaveTextContent(
      'label.approval-plural:0'
    );
  });

  it('renders an empty state when a filter matches nothing', () => {
    render(<NeedsYouNowSection items={[ITEMS[0]]} />);

    fireEvent.click(screen.getByTestId('tab-health'));

    expect(screen.getByTestId('needs-you-now-empty')).toBeInTheDocument();
    expect(screen.queryByTestId(LIST_TESTID)).not.toBeInTheDocument();
  });

  it('holds back items past the fold until show more is pressed', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      ...ITEMS[0],
      id: `bulk-${i}`,
    }));

    render(<NeedsYouNowSection items={many} />);

    expect(
      within(screen.getByTestId(LIST_TESTID)).getAllByRole('listitem')
    ).toHaveLength(5);

    fireEvent.click(screen.getByTestId('needs-you-now-show-more'));

    expect(
      within(screen.getByTestId(LIST_TESTID)).getAllByRole('listitem')
    ).toHaveLength(7);
  });
});
