/*
 *  Copyright 2022 Collate.
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
import React from 'react';
import { MOCK_TABLE } from '../../mocks/TableData.mock';
import SampleDataTable from './SampleDataTable.component';

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children }) => <span>{children}</span>),
  useLocation: jest.fn().mockImplementation(() => ({ pathname: 'test' })),
}));

jest.mock('rest/tableAPI', () => ({
  getSampleDataByTableId: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TABLE)),
}));

describe('Test SampleDataTable Component', () => {
  it('Renders all the data that was sent to the component', async () => {
    await act(async () => {
      render(<SampleDataTable tableId="id" />);
    });
    const columns = screen.getAllByTestId('column-name');

    expect(columns).toHaveLength(4);

    const rows = screen.getAllByTestId('row');

    expect(rows).toHaveLength(3);

    const cells = screen.getAllByTestId('cell');

    expect(cells).toHaveLength(12);
  });

  it('Renders no data if the columns passed are empty', () => {
    const { queryByTestId } = render(<SampleDataTable tableId="id" />);

    expect(queryByTestId('column-name')).toBeNull();
    expect(queryByTestId('cell')).toBeNull();
  });
});
