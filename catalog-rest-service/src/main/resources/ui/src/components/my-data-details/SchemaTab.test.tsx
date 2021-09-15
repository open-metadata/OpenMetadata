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

import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import SchemaTab from './SchemaTab';

const mockColumns = [
  {
    name: 'testId',
    columnDataType: 'string',
    description: 'string',
    fullyQualifiedName: 'string',
    tags: [{ tagFQN: 'string' }, { tagFQN: 'string2' }],
    ordinalPosition: 2,
  },
];

const mockjoins = [
  {
    columnName: 'testId',
    joinedWith: [{ fullyQualifiedName: 'joinedTable', joinCount: 1 }],
  },
];

const mockSampleData = {
  columns: ['test 1', 'test 2', 'test 3'],
  rows: [
    ['test 1 - string 1', 'test 1 - string 2', 'test 1 - string 3'],
    ['test 2 - string 1', 'test 2 - string 2', 'test 2 - string 3'],
    ['test 3 - string 1', 'test 3 - string 2', 'test 3 - string 3'],
  ],
};

const mockUpdate = jest.fn();

jest.mock('./SchemaTable', () =>
  jest.fn().mockReturnValue(<p data-testid="schema-table">SchemaTable</p>)
);

jest.mock('./SampleDataTable', () =>
  jest
    .fn()
    .mockReturnValue(<p data-testid="sample-data-table">SampleDataTable</p>)
);

jest.mock('../common/searchbar/Searchbar', () =>
  jest.fn().mockReturnValue(<p data-testid="search-bar-container">Searchbar</p>)
);

describe('Test SchemaTab Component', () => {
  it('Renders all the parts of the schema tab', () => {
    const { queryByTestId, container } = render(
      <SchemaTab
        columnName="test 1"
        columns={mockColumns}
        joins={mockjoins}
        sampleData={mockSampleData}
        onUpdate={mockUpdate}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const searchBar = getByTestId(container, 'search-bar-container');

    expect(searchBar).toBeInTheDocument();

    const schemaTable = getByTestId(container, 'schema-table');

    expect(schemaTable).toBeInTheDocument();
    expect(queryByTestId('sample-data-table')).toBeNull();
  });
});
