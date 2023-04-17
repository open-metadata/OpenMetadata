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
import { Query } from 'generated/entity/data/query';
import { MOCK_QUERIES } from 'mocks/Queries.mock';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryUsedByOtherTableProps } from '../TableQueries.interface';
import QueryUsedByOtherTable from './QueryUsedByOtherTable.component';

const mockProps: QueryUsedByOtherTableProps = {
  query: MOCK_QUERIES[0] as Query,
  tableId: MOCK_QUERIES[0].queryUsedIn[0].id,
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

  it('Top 3 except current table should visible, with view more button', async () => {
    const table1 = MOCK_QUERIES[0].queryUsedIn[1].name;
    const table2 = MOCK_QUERIES[0].queryUsedIn[2].name;
    const table3 = MOCK_QUERIES[0].queryUsedIn[3].name;
    render(<QueryUsedByOtherTable {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const viewMore = await screen.findByTestId('show-more');

    expect(await screen.findByText(table1)).toBeInTheDocument();
    expect(await screen.findByText(table2)).toBeInTheDocument();
    expect(await screen.findByText(table3)).toBeInTheDocument();
    expect(viewMore.textContent).toEqual('5 label.more-lowercase');
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
      'message.query-used-by-other-tables:  --'
    );
  });
});
