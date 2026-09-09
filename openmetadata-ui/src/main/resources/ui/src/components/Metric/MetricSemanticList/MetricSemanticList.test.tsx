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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import type { Metric } from '../../../generated/entity/data/metric';
import MetricSemanticList from './MetricSemanticList';
import { MetricSemanticItem } from './MetricSemanticList.interface';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <>{children}</>,
}));

const NEW_DESCRIPTION = 'new description';

const mockOnUpdate = jest.fn();

const ITEMS: MetricSemanticItem[] = [
  {
    name: 'order_date',
    expression: 'DATE_TRUNC(day, o.created_at)',
    description: 'Order day',
  },
  { name: 'region', expression: 'c.region' },
];

const METRIC = {
  id: 'metric-1',
  name: 'revenue',
  dimensions: ITEMS,
} as Metric;

const PERMISSIONS = {
  EditAll: true,
  EditDescription: false,
} as OperationPermission;

const renderList = (props = {}) =>
  render(
    <MetricSemanticList
      dataTestId="metric-dimensions-widget"
      entityLabel="Dimension"
      entityLabelLowercase="dimension"
      fieldKey="dimensions"
      getBadge={(item) => (item as { type?: string }).type}
      items={ITEMS}
      metric={METRIC}
      permissions={PERMISSIONS}
      title="Dimensions"
      onUpdate={mockOnUpdate}
      {...props}
    />
  );

describe('MetricSemanticList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders one row per item with name and expression', () => {
    renderList();

    expect(screen.getByTestId('semantic-item-order_date')).toBeInTheDocument();
    expect(screen.getByTestId('semantic-item-region')).toBeInTheDocument();
    expect(
      screen.getByText('DATE_TRUNC(day, o.created_at)')
    ).toBeInTheDocument();
    expect(screen.getByText('Order day')).toBeInTheDocument();
  });

  it('renders the badge when the accessor returns a value', () => {
    renderList({
      items: [{ name: 'order_date' }],
      getBadge: () => 'TIME',
    });

    expect(
      screen.getByTestId('semantic-item-badge-order_date')
    ).toHaveTextContent('TIME');
  });

  it('renders the item count beside the title', () => {
    renderList();

    expect(screen.getByTestId('semantic-list-count')).toHaveTextContent('2');
  });

  it('hides the item count when there are no items', () => {
    renderList({ items: [] });

    expect(screen.queryByTestId('semantic-list-count')).not.toBeInTheDocument();
  });

  it('hides the edit button when the user lacks permission', () => {
    renderList({
      permissions: { EditAll: false, EditDescription: false },
    });

    expect(
      screen.queryByTestId('edit-description-order_date')
    ).not.toBeInTheDocument();
  });

  it('hides the edit button when the metric is deleted', () => {
    renderList({
      metric: {
        id: 'metric-1',
        name: 'revenue',
        dimensions: ITEMS,
        deleted: true,
      },
    });

    expect(
      screen.queryByTestId('edit-description-order_date')
    ).not.toBeInTheDocument();
  });

  it('patches the edited item and leaves siblings untouched', async () => {
    renderList();

    fireEvent.click(screen.getByTestId('edit-description-region'));
    fireEvent.change(
      screen.getByRole('textbox', { name: /label\.description/ }),
      { target: { value: NEW_DESCRIPTION } }
    );
    fireEvent.click(await screen.findByTestId('semantic-description-save'));

    await waitFor(() =>
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          dimensions: [
            ITEMS[0],
            {
              name: 'region',
              expression: 'c.region',
              description: NEW_DESCRIPTION,
            },
          ],
        }),
        'dimensions'
      )
    );
  });

  it('edits only the selected row when two items share a name', async () => {
    const duplicates: MetricSemanticItem[] = [
      { name: 'region', expression: 'c.region' },
      { name: 'region', expression: 'o.region' },
    ];
    renderList({
      items: duplicates,
      metric: { id: 'metric-1', name: 'revenue', dimensions: duplicates },
    });

    fireEvent.click(screen.getAllByTestId('edit-description-region')[1]);
    fireEvent.change(
      screen.getByRole('textbox', { name: /label\.description/ }),
      { target: { value: NEW_DESCRIPTION } }
    );
    fireEvent.click(await screen.findByTestId('semantic-description-save'));

    await waitFor(() =>
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          dimensions: [
            { name: 'region', expression: 'c.region' },
            {
              name: 'region',
              expression: 'o.region',
              description: NEW_DESCRIPTION,
            },
          ],
        }),
        'dimensions'
      )
    );
  });

  it('renders nothing in the body when there are no items', () => {
    renderList({ items: [] });

    expect(screen.queryByTestId('semantic-list-body')).not.toBeInTheDocument();
  });

  it('reveals items beyond the first five only after show more', () => {
    const many = Array.from({ length: 7 }, (_, index) => ({
      name: `dim_${index}`,
    }));
    renderList({ items: many });

    expect(screen.queryByTestId('semantic-item-dim_6')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('show-more'));

    expect(screen.getByTestId('semantic-item-dim_6')).toBeInTheDocument();
  });
});
