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

import { fireEvent, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { schemaDetails } from '../../pages/my-data-details/index.mock';
import SchemaTab from './SchemaTab';

describe('Test SchemaTab Component', () => {
  it('Renders all the parts of the schema tab', () => {
    const { queryByTestId, container } = render(
      <SchemaTab columns={schemaDetails.columns} data={schemaDetails.data} />
    );
    const searchBar = getByTestId(container, 'search-bar-container');

    expect(searchBar).toBeInTheDocument();

    const schemaToggle = getByTestId(container, 'schema-button');

    expect(schemaToggle).toBeInTheDocument();

    const sampleDataToggle = getByTestId(container, 'sample-data-button');

    expect(sampleDataToggle).toBeInTheDocument();

    const schemaTable = getByTestId(container, 'schema-table');

    expect(schemaTable).toBeInTheDocument();
    expect(queryByTestId('sample-data-table')).toBeNull();
  });

  it('Renders the sample data table when toggle is clicked', () => {
    const { queryByTestId, container } = render(
      <SchemaTab columns={schemaDetails.columns} data={schemaDetails.data} />
    );

    expect(queryByTestId('sample-data-table')).toBeNull();

    const sampleDataToggle = getByTestId(container, 'sample-data-button');
    fireEvent.click(sampleDataToggle);
    const sampleDataTable = getByTestId(container, 'sample-data-table');

    expect(sampleDataTable).toBeInTheDocument();
  });
});
