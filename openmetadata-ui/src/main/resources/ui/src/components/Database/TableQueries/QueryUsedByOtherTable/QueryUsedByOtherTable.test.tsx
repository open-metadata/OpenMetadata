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
import { Query } from '../../../../generated/entity/data/query';
import { MOCK_QUERIES } from '../../../../mocks/Queries.mock';
import { searchData } from '../../../../rest/miscAPI';
import { MOCK_EXPLORE_SEARCH_RESULTS } from '../../../Explore/Explore.mock';
import { QueryUsedByOtherTableProps } from '../TableQueries.interface';
import QueryUsedByOtherTable from './QueryUsedByOtherTable.component';

const mockProps: QueryUsedByOtherTableProps = {
  query: MOCK_QUERIES[0] as Query,
  isEditMode: false,
  onChange: jest.fn(),
};

jest.mock('../../../common/AsyncSelect/AsyncSelect', () => ({
  AsyncSelect: jest
    .fn()
    .mockImplementation(() => <div>AsyncSelect.component</div>),
}));

jest.mock('../../../../rest/miscAPI', () => ({
  searchData: jest
    .fn()
    .mockReturnValue(() => Promise.resolve(MOCK_EXPLORE_SEARCH_RESULTS)),
}));

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

  it('Should display select box if edit mode is true', async () => {
    render(<QueryUsedByOtherTable {...mockProps} isEditMode />, {
      wrapper: MemoryRouter,
    });
    const selectField = await screen.findByText('AsyncSelect.component');

    expect(selectField).toBeInTheDocument();
  });

  it('Should fetch initial dropdown list in edit mode', async () => {
    const mockSearchData = searchData as jest.Mock;
    render(<QueryUsedByOtherTable {...mockProps} isEditMode />, {
      wrapper: MemoryRouter,
    });
    const selectField = await screen.findByText('AsyncSelect.component');

    expect(selectField).toBeInTheDocument();
    expect(mockSearchData).toHaveBeenCalledWith(
      '',
      1,
      25,
      '',
      '',
      '',
      'table_search_index'
    );
  });

  it('Loader should be visible while loading the initial options', async () => {
    render(<QueryUsedByOtherTable {...mockProps} isEditMode />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('loader')).toBeInTheDocument();

    const selectField = await screen.findByText('AsyncSelect.component');

    expect(selectField).toBeInTheDocument();
  });
});
