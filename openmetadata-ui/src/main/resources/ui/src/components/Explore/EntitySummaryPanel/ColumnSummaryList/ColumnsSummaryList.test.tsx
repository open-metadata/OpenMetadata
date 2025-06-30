/*
 *  Copyright 2024 Collate.
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

import { act, render, screen } from '@testing-library/react';
import { EntityType } from '../../../../enums/entity.enum';
import { getDataModelColumnsByFQN } from '../../../../rest/dataModelsAPI';
import { getTableColumnsByFQN } from '../../../../rest/tableAPI';
import { mockTableEntityDetails } from '../mocks/TableSummary.mock';
import { ColumnSummaryList } from './ColumnsSummaryList';

jest.mock('../../../../rest/tableAPI', () => ({
  getTableColumnsByFQN: jest
    .fn()
    .mockImplementation(() => ({ data: [], paging: { total: 0 } })),
}));

jest.mock('../../../../rest/dataModelsAPI', () => ({
  getDataModelColumnsByFQN: jest
    .fn()
    .mockImplementation(() => ({ data: [], paging: { total: 0 } })),
}));

jest.mock('../SummaryList/SummaryList.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="summary-list">SummaryList</div>)
);

jest.mock('../../../../utils/EntitySummaryPanelUtils', () => ({
  getFormattedEntityData: jest.fn(),
}));

jest.mock('../../../../constants/constants', () => ({
  PAGE_SIZE_LARGE: 10,
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Skeleton: jest
    .fn()
    .mockImplementation(() => <div data-testid="skeleton">Skeleton</div>),
}));

const mockColumns = [
  {
    name: 'api_client_id',
    dataType: 'numeric',
    dataTypeDisplay: 'numeric',
    description: 'ID of the API client',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify."dim.api/client".api_client_id',
    tags: [],
    ordinalPosition: 1,
  },
  {
    name: 'title',
    dataType: 'varchar',
    dataLength: 100,
    dataTypeDisplay: 'varchar',
    description: 'Full name of the app or channel',
    fullyQualifiedName:
      'sample_data.ecommerce_db.shopify."dim.api/client".title',
    tags: [],
    ordinalPosition: 2,
  },
];

const mockPaging = {
  total: 2,
  offset: 0,
  limit: 10,
};

describe('ColumnSummaryList Component', () => {
  it('should render loading state initially', async () => {
    (getTableColumnsByFQN as jest.Mock).mockImplementationOnce(
      () =>
        new Promise(() => {
          // Never resolve to simulate loading state
        })
    );

    render(
      <ColumnSummaryList
        entityInfo={mockTableEntityDetails}
        entityType={EntityType.TABLE}
      />
    );

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('should fetch and render columns for table entity type', async () => {
    (getTableColumnsByFQN as jest.Mock).mockResolvedValueOnce({
      data: mockColumns,
      paging: mockPaging,
    });

    await act(async () => {
      render(
        <ColumnSummaryList
          entityInfo={mockTableEntityDetails}
          entityType={EntityType.TABLE}
          highlights={{}}
        />
      );
    });

    expect(getTableColumnsByFQN).toHaveBeenCalledWith(
      mockTableEntityDetails.fullyQualifiedName,
      {
        offset: 0,
        limit: 10,
      }
    );
    expect(screen.getByTestId('summary-list')).toBeInTheDocument();
  });

  it('should fetch and render columns for dashboard data model entity type', async () => {
    (getDataModelColumnsByFQN as jest.Mock).mockResolvedValueOnce({
      data: mockColumns,
      paging: mockPaging,
    });

    await act(async () => {
      render(
        <ColumnSummaryList
          entityInfo={mockTableEntityDetails}
          entityType={EntityType.DASHBOARD_DATA_MODEL}
          highlights={{}}
        />
      );
    });

    expect(getDataModelColumnsByFQN).toHaveBeenCalledWith(
      mockTableEntityDetails.fullyQualifiedName,
      {
        offset: 0,
        limit: 10,
      }
    );
    expect(screen.getByTestId('summary-list')).toBeInTheDocument();
  });

  it('should handle load more functionality', async () => {
    const initialColumns = mockColumns.slice(0, 1);
    const moreColumns = mockColumns.slice(1);
    const initialPaging = { ...mockPaging, total: 2 };
    const updatedPaging = { ...mockPaging, offset: 1, total: 2 };

    (getTableColumnsByFQN as jest.Mock)
      .mockResolvedValueOnce({
        data: initialColumns,
        paging: initialPaging,
      })
      .mockResolvedValueOnce({
        data: moreColumns,
        paging: updatedPaging,
      });

    await act(async () => {
      render(
        <ColumnSummaryList
          entityInfo={mockTableEntityDetails}
          entityType={EntityType.TABLE}
          highlights={{}}
        />
      );
    });

    const loadMoreButton = screen.getByText('label.show-more');

    expect(loadMoreButton).toBeInTheDocument();

    await act(async () => {
      loadMoreButton.click();
    });

    expect(getTableColumnsByFQN).toHaveBeenCalledTimes(2);
    expect(getTableColumnsByFQN).toHaveBeenLastCalledWith(
      mockTableEntityDetails.fullyQualifiedName,
      {
        offset: 10,
        limit: 10,
      }
    );
  });

  it('should not show load more button when all columns are loaded', async () => {
    (getTableColumnsByFQN as jest.Mock).mockResolvedValueOnce({
      data: mockColumns,
      paging: { ...mockPaging, total: 2 },
    });

    await act(async () => {
      render(
        <ColumnSummaryList
          entityInfo={mockTableEntityDetails}
          entityType={EntityType.TABLE}
          highlights={{}}
        />
      );
    });

    expect(screen.queryByText('label.show-more')).not.toBeInTheDocument();
  });

  it('should handle API error gracefully', async () => {
    (getTableColumnsByFQN as jest.Mock).mockRejectedValueOnce(
      new Error('API Error')
    );

    await act(async () => {
      render(
        <ColumnSummaryList
          entityInfo={mockTableEntityDetails}
          entityType={EntityType.TABLE}
          highlights={{}}
        />
      );
    });

    expect(screen.getByTestId('summary-list')).toBeInTheDocument();
  });
});
