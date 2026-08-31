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
import { MemoryRouter } from 'react-router-dom';
import type { Metric } from '../../../generated/entity/data/metric';
import {
  EntityStatus,
  MetricGranularity,
  MetricType,
} from '../../../generated/entity/data/metric';
import MetricHierarchyCard from './MetricHierarchyCard';
import { useMetricHierarchyCard } from './useMetricHierarchyCard';

jest.mock('./useMetricHierarchyCard', () => ({
  useMetricHierarchyCard: jest.fn(),
}));

jest.mock('../MetricListHealth/MetricListHealth.component', () => ({
  __esModule: true,
  default: ({ metricId }: { metricId: string }) => (
    <span data-testid={`hierarchy-health-${metricId}`}>health</span>
  ),
}));

const metric = {
  id: 'current-id',
  name: 'gross_margin_rate',
  fullyQualifiedName: 'gross_margin_rate',
  entityStatus: EntityStatus.InReview,
  granularity: MetricGranularity.Day,
  metricType: MetricType.Ratio,
  owners: [{ id: 'owner-id', name: 'finance-team', type: 'team' }],
} as Metric;

const hierarchy = {
  group: undefined,
  ancestors: [],
  siblings: [],
  children: [],
  isPending: false,
  error: null,
  refetch: jest.fn(),
  hasMoreChildren: false,
  hasMoreSiblings: false,
  isLoadingChildren: false,
  isLoadingSiblings: false,
  loadMoreChildren: jest.fn(),
  loadMoreSiblings: jest.fn(),
};

const renderCard = (canAddChild = true) =>
  render(
    <MemoryRouter>
      <MetricHierarchyCard canAddChild={canAddChild} metric={metric} />
    </MemoryRouter>
  );

describe('MetricHierarchyCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMetricHierarchyCard as jest.Mock).mockReturnValue(hierarchy);
  });

  it('shows a stable standalone state and a permission-gated Add Child action', () => {
    renderCard();

    expect(screen.getByTestId('metric-tree-empty')).toBeInTheDocument();
    expect(screen.getByTestId('metric-hierarchy-header')).toHaveClass(
      'tw:flex-col',
      'tw:sm:flex-row'
    );
    expect(screen.getByTestId('metric-hierarchy-card')).toHaveClass(
      'tw:shadow-xs'
    );
    expect(screen.getByTestId('metric-hierarchy-header-icon')).toHaveClass(
      'tw:size-5',
      'tw:text-fg-quaternary'
    );
    expect(
      screen
        .getByTestId('metric-hierarchy-header')
        .querySelector('[data-featured-icon]')
    ).not.toBeInTheDocument();

    const addChildLink = screen.getByRole('link', {
      name: 'label.add-child-metric',
    });

    expect(addChildLink).toHaveAttribute(
      'href',
      expect.stringContaining('parent=gross_margin_rate')
    );
    expect(addChildLink).toHaveClass(
      'tw:border-dashed',
      'tw:shadow-none',
      'tw:py-1'
    );
  });

  it('renders the complete grouped hierarchy with compact metadata and trailing health', () => {
    (useMetricHierarchyCard as jest.Mock).mockReturnValue({
      ...hierarchy,
      group: { id: 'group-id', name: 'profitability', metricCount: 4 },
      ancestors: [
        {
          id: 'root-id',
          name: 'profit',
          fullyQualifiedName: 'profit',
          metricType: MetricType.Ratio,
          entityStatus: EntityStatus.Approved,
        },
      ],
      siblings: [
        {
          id: 'peer-id',
          name: 'net_margin',
          fullyQualifiedName: 'net_margin',
          metricType: MetricType.Sum,
          granularity: MetricGranularity.Day,
          entityStatus: EntityStatus.Approved,
          owners: [
            {
              id: 'peer-owner-id',
              displayName: 'Alex Brown',
              type: 'user',
            },
          ],
        },
      ],
      children: [
        {
          id: 'child-id',
          name: 'emea_margin',
          fullyQualifiedName: 'emea_margin',
          metricType: MetricType.Ratio,
          granularity: MetricGranularity.Week,
          entityStatus: EntityStatus.InReview,
          owners: [
            {
              id: 'child-owner-id',
              displayName: 'Jamie Lee',
              type: 'user',
            },
          ],
        },
      ],
    });

    renderCard();

    expect(screen.getByTestId('metric-tree-group')).toHaveTextContent(
      'profitability'
    );
    expect(
      screen.getByTestId('metric-tree-ancestor-root-id')
    ).toBeInTheDocument();
    expect(screen.getByTestId('metric-tree-peer-peer-id')).toBeInTheDocument();
    expect(screen.getByTestId('metric-tree-current')).toHaveTextContent(
      'gross_margin_rate'
    );
    expect(screen.getByTestId('metric-tree-current')).toHaveClass(
      'tw:bg-brand-primary_alt'
    );
    expect(screen.getByTestId('metric-tree-current')).not.toHaveClass(
      'tw:bg-brand-primary'
    );
    expect(
      screen.getByTestId('metric-tree-child-child-id')
    ).toBeInTheDocument();
    expect(screen.getByTestId('metric-tree-current')).toHaveTextContent(
      'label.in-review'
    );
    expect(screen.getByTestId('metric-tree-current-metric-type')).toHaveClass(
      'tw:font-mono',
      'tw:uppercase',
      'tw:bg-utility-purple-50'
    );
    expect(screen.getByTestId('metric-tree-current-granularity')).toHaveClass(
      'tw:font-mono',
      'tw:uppercase'
    );
    expect(screen.getByTestId('metric-tree-current-status')).toHaveClass(
      'tw:text-xs',
      'tw:text-tertiary'
    );
    expect(screen.getAllByTestId('metric-tree-current-separator')).toHaveLength(
      2
    );
    expect(screen.getByTestId('metric-tree-current')).toHaveTextContent(
      'label.you-are-here'
    );
    expect(
      screen.queryByTestId('hierarchy-health-current-id')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('metric-tree-owner-current-id-owner-id')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('metric-tree-owner-peer-id-peer-owner-id')
    ).toHaveAttribute('aria-label', 'Alex Brown');
    expect(screen.getByRole('img', { name: 'Alex Brown' })).toBeInTheDocument();
    expect(
      screen.getByTestId('metric-tree-owner-child-id-child-owner-id')
    ).toHaveTextContent('JL');
    expect(screen.getByTestId('hierarchy-health-peer-id')).toBeInTheDocument();
    expect(screen.getByTestId('hierarchy-health-child-id')).toBeInTheDocument();
    expect(screen.getByLabelText('4 label.metric-plural')).toBeInTheDocument();

    [
      'metric-tree-ancestor-root-id',
      'metric-tree-peer-peer-id',
      'metric-tree-current',
      'metric-tree-child-child-id',
    ].forEach((testId) => {
      expect(screen.getByTestId(testId)).toHaveClass('tw:pl-8');
      expect(screen.getByTestId(`${testId}-elbow`)).toBeInTheDocument();
    });

    expect(screen.getByTestId('metric-tree-peer-peer-id')).toHaveAttribute(
      'href',
      '/metric/net_margin'
    );
    expect(screen.getByTestId('metric-tree-child-child-id')).toHaveAttribute(
      'href',
      '/metric/emea_margin'
    );
  });

  it('loads the next sibling and child pages from explicit controls', () => {
    const loadMoreChildren = jest.fn();
    const loadMoreSiblings = jest.fn();
    (useMetricHierarchyCard as jest.Mock).mockReturnValue({
      ...hierarchy,
      children: [{ id: 'child-id', name: 'child' }],
      hasMoreChildren: true,
      hasMoreSiblings: true,
      loadMoreChildren,
      loadMoreSiblings,
    });

    renderCard();
    fireEvent.click(screen.getByTestId('metric-tree-more-peers'));
    fireEvent.click(screen.getByTestId('metric-tree-more-children'));

    expect(loadMoreSiblings).toHaveBeenCalled();
    expect(loadMoreChildren).toHaveBeenCalled();
  });

  it('offers an accessible retry without hiding the rest of the page', () => {
    const refetch = jest.fn();
    (useMetricHierarchyCard as jest.Mock).mockReturnValue({
      ...hierarchy,
      error: new Error('unavailable'),
      refetch,
    });

    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'label.try-again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('does not expose Add Child without create permission', () => {
    renderCard(false);

    expect(
      screen.queryByRole('link', { name: 'label.add-child-metric' })
    ).not.toBeInTheDocument();
  });

  it('announces the localized hierarchy loading state', () => {
    (useMetricHierarchyCard as jest.Mock).mockReturnValue({
      ...hierarchy,
      isPending: true,
    });

    renderCard();

    expect(
      screen.getByRole('status', { name: 'label.loading' })
    ).toBeInTheDocument();
  });
});
