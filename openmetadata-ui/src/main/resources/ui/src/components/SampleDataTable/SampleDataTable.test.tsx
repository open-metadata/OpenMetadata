/*
 *  Copyright 2021 Collate
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

import { getAllByTestId, render } from '@testing-library/react';
import React from 'react';
import SampleDataTable from './SampleDataTable.component';

const mockSampleData = {
  columns: [
    {
      name: 'column 1',
      dataType: 'uuid',
    },
    {
      name: 'column 2',
      dataType: 'string',
    },
    {
      name: 'column 3',
      dataType: 'number',
    },
  ],
  rows: [
    ['row 1', 'row 2', 'row 3'],
    ['row 1', 'row 2', 'row 3'],
    ['row 1', 'row 2', 'row 3'],
  ],
};

describe('Test SampleDataTable Component', () => {
  it('Renders all the data that was sent to the component', () => {
    const { container } = render(
      <SampleDataTable sampleData={mockSampleData} />
    );
    const columns = getAllByTestId(container, 'column-name');

    expect(columns.length).toBe(3);

    const rows = getAllByTestId(container, 'row');

    expect(rows.length).toBe(3);

    const cells = getAllByTestId(container, 'cell');

    expect(cells.length).toBe(9);
  });

  it('Renders no data if the columns passed are empty', () => {
    const { queryByTestId } = render(
      <SampleDataTable
        sampleData={{
          columns: [],
          rows: [],
        }}
      />
    );

    expect(queryByTestId('column-name')).toBeNull();
    expect(queryByTestId('cell')).toBeNull();
  });
});
