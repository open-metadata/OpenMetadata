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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { Node } from 'reactflow';
import { LineageDirection } from '../../../generated/api/lineage/lineageDirection';
import { getTableDetailsByFQN } from '../../../rest/tableAPI';
import { getAggregationOptions } from '../../../utils/ExploreUtils';
import { DataAssetOption } from '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import AddLineagePopover from './AddLineagePopover';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn(),
}));
jest.mock('../../../rest/dataModelsAPI', () => ({
  getDataModelByFqn: jest.fn(),
}));
jest.mock('../../../utils/ExploreUtils', () => ({
  getAggregationOptions: jest.fn(),
}));
jest.mock('../../../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));

const ORDERS: DataAssetOption = {
  displayName: 'orders',
  name: 'orders',
  value: 's.d.sc.orders',
  reference: { id: 'b', type: 'table', fullyQualifiedName: 's.d.sc.orders' },
};

// The asset list is its own tested component; here it only has to hand back a pick.
jest.mock(
  '../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList',
  () => ({
    __esModule: true,
    default: ({
      onChange,
      searchIndex,
      queryFilter,
    }: {
      onChange: (option: DataAssetOption) => void;
      searchIndex: string;
      queryFilter?: unknown;
    }) => (
      <button
        data-query-filter={JSON.stringify(queryFilter)}
        data-search-index={searchIndex}
        data-testid="pick-orders"
        onClick={() => onChange(ORDERS)}>
        pick
      </button>
    ),
  })
);

const triggerRef = createRef<HTMLElement>() as { current: HTMLElement };
triggerRef.current = document.createElement('button');

const baseProps = {
  excludeEntityId: 'self',
  nodeName: 'customers',
  onClose: jest.fn(),
  onSubmit: jest.fn().mockResolvedValue(true),
};

// FilterSelect's menu does not settle under userEvent's pointer sequence in
// jsdom; a plain click opens it and picks a row.
const pickType = async (index = 'table') => {
  fireEvent.click(screen.getByTestId('add-lineage-type-select'));
  fireEvent.click(
    within(await screen.findByTestId('drop-down-menu')).getByTestId(index)
  );
};

describe('AddLineagePopover', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.clearAllMocks();
    user = userEvent.setup({ delay: null, pointerEventsCheck: 0 });
    (getAggregationOptions as jest.Mock).mockResolvedValue({
      data: {
        aggregations: {
          'sterms#entityType': {
            buckets: [{ key: 'table', doc_count: 528 }],
          },
        },
      },
    });
  });

  const open = (direction = LineageDirection.Downstream, columnFqn?: string) =>
    render(
      <AddLineagePopover
        {...baseProps}
        request={{ nodeId: 'n1', direction, columnFqn, triggerRef }}
      />
    );

  it('renders nothing without a request', () => {
    render(<AddLineagePopover {...baseProps} />);

    expect(screen.queryByTestId('add-lineage-popover')).not.toBeInTheDocument();
  });

  it('shows the direction title', () => {
    open(LineageDirection.Upstream);

    expect(screen.getAllByText('label.add-upstream').length).toBeGreaterThan(0);
  });

  it('lists asset types with their counts', async () => {
    open();
    fireEvent.click(screen.getByTestId('add-lineage-type-select'));
    const menu = await screen.findByTestId('drop-down-menu');

    await waitFor(() =>
      expect(within(menu).getByTestId('table')).toHaveTextContent('528')
    );
  });

  it('searches the chosen type without the current entity and submits on Add', async () => {
    open();

    expect(screen.getByTestId('add-lineage-submit')).toBeDisabled();

    await pickType();
    const list = screen.getByTestId('pick-orders');

    expect(list).toHaveAttribute('data-search-index', 'table');
    expect(list.getAttribute('data-query-filter')).toContain('self');

    fireEvent.click(list);

    expect(baseProps.onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('add-lineage-submit'));

    await waitFor(() =>
      expect(baseProps.onSubmit).toHaveBeenCalledWith({
        entity: { id: 'b', type: 'table', fullyQualifiedName: 's.d.sc.orders' },
      })
    );
  });

  it('previews the new edge with the current node on the matching side', async () => {
    open(LineageDirection.Upstream);
    await pickType();
    fireEvent.click(screen.getByTestId('pick-orders'));

    expect(screen.getByTestId('add-lineage-preview').textContent).toMatch(
      /orders.*customers/
    );
  });

  it('picks a column edit target among the canvas nodes and submits the column', async () => {
    (getTableDetailsByFQN as jest.Mock).mockResolvedValue({
      columns: [{ name: 'id', fullyQualifiedName: 's.d.sc.orders.id' }],
    });
    const canvasNode = (node: Record<string, unknown>) =>
      ({ id: node.id, position: { x: 0, y: 0 }, data: { node } } as Node);
    render(
      <AddLineagePopover
        {...baseProps}
        canvasNodes={[
          canvasNode({
            id: 'self',
            name: 'self',
            fullyQualifiedName: 's.d.sc.self',
            entityType: 'table',
          }),
          canvasNode({
            id: 'b',
            name: 'orders',
            fullyQualifiedName: 's.d.sc.orders',
            entityType: 'table',
          }),
          canvasNode({
            id: 'p',
            name: 'etl',
            fullyQualifiedName: 's.etl',
            entityType: 'pipeline',
          }),
        ]}
        excludeEntityId="self"
        request={{
          nodeId: 'n1',
          direction: LineageDirection.Downstream,
          columnFqn: 's.d.sc.self.id',
          triggerRef,
        }}
      />
    );

    // The catalog-wide type and asset search is not offered for a column.
    expect(
      screen.queryByTestId('add-lineage-type-select')
    ).not.toBeInTheDocument();

    await user.click(
      within(screen.getByTestId('add-lineage-canvas-asset-select')).getByRole(
        'button'
      )
    );

    // Only column-carrying nodes other than the current one are listed.
    expect(screen.getAllByRole('option')).toHaveLength(1);

    await user.click(screen.getByRole('option', { name: /orders/ }));

    expect(screen.getByTestId('add-lineage-submit')).toBeDisabled();

    await user.click(
      within(screen.getByTestId('add-lineage-column-select')).getByRole(
        'button'
      )
    );
    await user.click(await screen.findByRole('option', { name: 'id' }));
    fireEvent.click(screen.getByTestId('add-lineage-submit'));

    await waitFor(() =>
      expect(baseProps.onSubmit).toHaveBeenCalledWith({
        entity: { id: 'b', type: 'table', fullyQualifiedName: 's.d.sc.orders' },
        columnFqn: 's.d.sc.orders.id',
      })
    );

    expect(getTableDetailsByFQN).toHaveBeenCalledWith('s.d.sc.orders', {
      fields: 'columns',
    });
  });

  it('stays open when submit fails, and ignores duplicate submits', async () => {
    let resolveSubmit: (value: boolean) => void = (_value: boolean) =>
      undefined;
    baseProps.onSubmit.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSubmit = resolve;
        })
    );
    open();
    await pickType();
    fireEvent.click(screen.getByTestId('pick-orders'));
    fireEvent.click(screen.getByTestId('add-lineage-submit'));
    fireEvent.click(screen.getByTestId('add-lineage-submit'));

    expect(baseProps.onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => resolveSubmit(false));

    expect(baseProps.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('add-lineage-popover')).toBeInTheDocument();
  });
});
