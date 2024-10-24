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

import { getByTestId, getByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MOCK_TABLE } from '../../../mocks/TableData.mock';
import SchemaTab from './SchemaTab.component';

const mockUpdate = jest.fn();

jest.mock('../SampleDataTable/SampleDataTable.component', () => {
  return jest.fn().mockReturnValue(<p>SampleDataTable</p>);
});

jest.mock('../SchemaTable/SchemaTable.component', () => {
  return jest.fn().mockReturnValue(<p>SchemaTable</p>);
});

describe('Test SchemaTab Component', () => {
  it('Renders all the parts of the schema tab', () => {
    const { queryByTestId, container } = render(
      <SchemaTab
        hasDescriptionEditAccess
        hasGlossaryTermEditAccess
        hasTagEditAccess
        isReadOnly={false}
        table={MOCK_TABLE}
        onThreadLinkSelect={jest.fn()}
        onUpdate={mockUpdate}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const searchBar = getByTestId(container, 'search-bar-container');

    expect(searchBar).toBeInTheDocument();

    const schemaTable = getByText(container, /SchemaTable/i);

    expect(schemaTable).toBeInTheDocument();
    expect(queryByTestId('sample-data-table')).toBeNull();
  });
});
