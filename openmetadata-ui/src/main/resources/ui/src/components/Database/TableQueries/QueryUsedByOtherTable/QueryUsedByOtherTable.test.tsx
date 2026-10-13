/*
 *  Copyright 2023 Collate.
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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchIndex } from '../../../../enums/search.enum';
import { Query } from '../../../../generated/entity/data/query';
import { MOCK_QUERIES } from '../../../../mocks/Queries.mock';
import { DataAssetAsyncSelectListProps } from '../../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import { QueryUsedByOtherTableProps } from '../TableQueries.interface';
import QueryUsedByOtherTable from './QueryUsedByOtherTable.component';

const mockDataAssetSelect = jest
  .fn()
  .mockImplementation(() => <div>DataAssetAsyncSelectList</div>);

jest.mock(
  '../../../DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList',
  () => (props: DataAssetAsyncSelectListProps) => mockDataAssetSelect(props)
);

const mockProps: QueryUsedByOtherTableProps = {
  query: MOCK_QUERIES[0] as Query,
  isEditMode: false,
  onChange: jest.fn(),
};

describe('QueryUsedByOtherTable test', () => {
  it('Component should render', async () => {
    render(<QueryUsedByOtherTable {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(await screen.findByTestId('para-container')).toBeInTheDocument();
    expect(await screen.findByTestId('show-more')).toBeInTheDocument();
    expect(
      await screen.findByText('message.query-used-by-other-tables:')
    ).toBeInTheDocument();
  });

  it('If no queryUsedIn available, "--" should visible', async () => {
    render(
      <QueryUsedByOtherTable
        {...mockProps}
        query={{ ...MOCK_QUERIES[0], queryUsedIn: [] } as Query}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const viewMore = screen.queryByTestId('show-more');
    const container = await screen.findByTestId('para-container');

    expect(viewMore).not.toBeInTheDocument();
    expect(container.textContent).toEqual(
      'message.query-used-by-other-tables:--'
    );
  });

  it('Should search tables and preselect the current ones in edit mode', async () => {
    render(<QueryUsedByOtherTable {...mockProps} isEditMode />, {
      wrapper: MemoryRouter,
    });

    expect(
      await screen.findByText('DataAssetAsyncSelectList')
    ).toBeInTheDocument();

    const props = mockDataAssetSelect.mock.calls[0][0];
    const usedIn = MOCK_QUERIES[0].queryUsedIn ?? [];

    expect(props.searchIndex).toBe(SearchIndex.TABLE);
    expect(props.multiple).toBe(true);
    expect(props.value).toEqual(usedIn.map((t) => t.fullyQualifiedName));
  });

  it('Should report the picked tables as entity references', async () => {
    const onChange = jest.fn();
    render(
      <QueryUsedByOtherTable {...mockProps} isEditMode onChange={onChange} />,
      { wrapper: MemoryRouter }
    );
    await screen.findByText('DataAssetAsyncSelectList');

    const reference = { id: 'table-id', type: 'table', name: 'orders' };
    mockDataAssetSelect.mock.calls[0][0].onChange([
      { displayName: 'orders', value: 'db.orders', reference },
    ]);

    expect(onChange).toHaveBeenCalledWith([reference]);
  });
});
