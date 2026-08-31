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
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import MetricSemanticList from './MetricSemanticList';
import { MetricSemanticItem } from './MetricSemanticList.interface';

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(),
}));

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest.fn(({ markdown }) => (
    <div data-testid="description-preview">{markdown}</div>
  ))
);

const NEW_DESCRIPTION = 'new description';

jest.mock(
  '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest.fn(({ visible, onSave }) =>
      visible ? (
        <button
          data-testid="save-description"
          onClick={() => onSave('new description')}>
          save
        </button>
      ) : null
    ),
  })
);

const mockOnUpdate = jest.fn();

const ITEMS: MetricSemanticItem[] = [
  {
    name: 'order_date',
    expression: 'DATE_TRUNC(day, o.created_at)',
    description: 'Order day',
  },
  { name: 'region', expression: 'c.region' },
];

const setContext = (overrides = {}) => {
  (useGenericContext as jest.Mock).mockReturnValue({
    data: { id: 'metric-1', name: 'revenue', dimensions: ITEMS },
    onUpdate: mockOnUpdate,
    // EditAll granted, EditDescription absent (not explicitly denied) — falls back to
    // EditAll under the prioritized getDerivedPermissionFlags derivation (Task 8 Batch 9),
    // same as it did under the old bare `EditAll || EditDescription` OR. Deliberately NOT
    // `EditDescription: false`, which would now correctly deny access (explicit-deny-wins) —
    // see the dedicated regression test below for that case.
    permissions: { EditAll: true },
    ...overrides,
  });
};

const renderList = (props = {}) =>
  render(
    <MetricSemanticList
      dataTestId="metric-dimensions-widget"
      entityLabel="Dimension"
      entityLabelLowercase="dimension"
      fieldKey="dimensions"
      getBadge={(item) => (item as { type?: string }).type}
      items={ITEMS}
      title="Dimensions"
      {...props}
    />
  );

describe('MetricSemanticList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setContext();
  });

  it('renders one row per item with name and expression', () => {
    renderList();

    expect(screen.getByTestId('semantic-item-order_date')).toBeInTheDocument();
    expect(screen.getByTestId('semantic-item-region')).toBeInTheDocument();
    expect(
      screen.getByText('DATE_TRUNC(day, o.created_at)')
    ).toBeInTheDocument();
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
    setContext({ permissions: { EditAll: false, EditDescription: false } });
    renderList();

    expect(
      screen.queryByTestId('edit-description-order_date')
    ).not.toBeInTheDocument();
  });

  // Regression coverage for the getDerivedPermissionFlags conversion (Task 8 Batch 9): an
  // explicit EditDescription: false must win over a bare EditAll: true grant
  // (explicit-deny-wins) — the old raw `EditAll || EditDescription` OR let EditAll grant
  // unconditionally.
  it('hides the edit button when EditDescription is explicitly false, even with EditAll true', () => {
    setContext({ permissions: { EditAll: true, EditDescription: false } });
    renderList();

    expect(
      screen.queryByTestId('edit-description-order_date')
    ).not.toBeInTheDocument();
  });

  it('hides the edit button when the metric is deleted', () => {
    setContext({
      data: {
        id: 'metric-1',
        name: 'revenue',
        dimensions: ITEMS,
        deleted: true,
      },
    });
    renderList();

    expect(
      screen.queryByTestId('edit-description-order_date')
    ).not.toBeInTheDocument();
  });

  it('patches the edited item and leaves siblings untouched', async () => {
    renderList();

    fireEvent.click(screen.getByTestId('edit-description-region'));
    fireEvent.click(await screen.findByTestId('save-description'));

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
    setContext({
      data: { id: 'metric-1', name: 'revenue', dimensions: duplicates },
    });
    renderList({ items: duplicates });

    fireEvent.click(screen.getAllByTestId('edit-description-region')[1]);
    fireEvent.click(await screen.findByTestId('save-description'));

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
