/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { getAllByTestId, render } from '@testing-library/react';
import React from 'react';
import { schemaDetails } from '../../pages/my-data-details/index.mock';
import SampleDataTable from './SampleDataTable';

describe('Test SampleDataTable Component', () => {
  it('Renders all the data that was sent to the component', () => {
    const { container } = render(
      <SampleDataTable
        columns={schemaDetails.columns}
        data={schemaDetails.data}
      />
    );
    const columns = getAllByTestId(container, 'column-name');

    expect(columns.length).toBe(18);

    const rows = getAllByTestId(container, 'row');

    expect(rows.length).toBe(19);

    const cells = getAllByTestId(container, 'cell');

    expect(cells.length).toBe(342);
  });

  it('Renders only data for the columns that was passed', () => {
    const { container } = render(
      <SampleDataTable
        columns={schemaDetails.columns.slice(0, 5)}
        data={schemaDetails.data}
      />
    );
    const columns = getAllByTestId(container, 'column-name');

    expect(columns.length).toBe(5);

    const rows = getAllByTestId(container, 'row');

    expect(rows.length).toBe(19);

    const cells = getAllByTestId(container, 'cell');

    expect(cells.length).toBe(95);
  });

  it('Renders no data if the columns passed are empty', () => {
    const { queryByTestId } = render(
      <SampleDataTable columns={[]} data={schemaDetails.data} />
    );

    expect(queryByTestId('column-name')).toBeNull();
    expect(queryByTestId('cell')).toBeNull();
  });
});
