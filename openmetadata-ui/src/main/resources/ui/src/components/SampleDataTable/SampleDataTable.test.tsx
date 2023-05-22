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
import { getSampleDataByTableId } from 'rest/tableAPI';
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

jest.mock('../common/error-with-placeholder/ErrorPlaceHolder', () => {
  return jest
    .fn()
    .mockReturnValue(
      <div data-testid="error-placeholder">ErrorPlaceholder</div>
    );
});

describe('Test SampleDataTable Component', () => {
  it('Render error placeholder if the columns passed are empty', async () => {
    (getSampleDataByTableId as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: '' })
    );

    await act(async () => {
      render(<SampleDataTable tableId="id" />);
    });

    const errorPlaceholder = screen.getByTestId('error-placeholder');

    expect(errorPlaceholder).toBeInTheDocument();
  });

  it('Renders all the data that was sent to the component', async () => {
    await act(async () => {
      render(<SampleDataTable tableId="id" />);
    });

    const table = screen.getByTestId('sample-data-table');

    expect(table).toBeInTheDocument();
  });
});
