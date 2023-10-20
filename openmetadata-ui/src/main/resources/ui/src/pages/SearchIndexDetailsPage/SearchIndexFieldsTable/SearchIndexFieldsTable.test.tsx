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
import React from 'react';
import { MOCK_SEARCH_INDEX_FIELDS } from '../../../mocks/SearchIndex.mock';
import SearchIndexFieldsTable from './SearchIndexFieldsTable';

const mockOnUpdate = jest.fn();
const mockOnThreadLinkSelect = jest.fn();

const mockProps = {
  searchIndexFields: MOCK_SEARCH_INDEX_FIELDS,
  searchedFields: MOCK_SEARCH_INDEX_FIELDS,
  onUpdate: mockOnUpdate,
  hasDescriptionEditAccess: true,
  hasTagEditAccess: true,
  onThreadLinkSelect: mockOnThreadLinkSelect,
  expandableConfig: {},
  entityFqn: 'search_service.search_index_fqn',
};

const mockSearchedFields = MOCK_SEARCH_INDEX_FIELDS.filter((field) =>
  field.name.includes('name')
);

jest.mock(
  '../../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockImplementation(() => <div>testModalWithMarkdownEditor</div>),
  })
);

jest.mock(
  '../../../components/common/error-with-placeholder/FilterTablePlaceHolder',
  () =>
    jest.fn().mockImplementation(() => <div>testFilterTablePlaceHolder</div>)
);

jest.mock(
  '../../../components/TableDescription/TableDescription.component',
  () => jest.fn().mockImplementation(() => <div>testTableDescription</div>)
);

jest.mock('../../../components/TableTags/TableTags.component', () =>
  jest.fn().mockImplementation(() => <div>testTableTags</div>)
);

describe('SearchIndexFieldsTable component', () => {
  it('SearchIndexFieldsTable should render a table with proper data', async () => {
    render(<SearchIndexFieldsTable {...mockProps} />);

    expect(screen.getByTestId('search-index-fields-table')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('columns')).toBeInTheDocument();
  });

  it('SearchIndexFieldsTable should not display data if fields data is empty', () => {
    render(
      <SearchIndexFieldsTable
        {...mockProps}
        isReadOnly={false}
        searchedFields={[]}
      />
    );

    expect(screen.getByTestId('search-index-fields-table')).toBeInTheDocument();
    expect(screen.queryByText('name')).toBeNull();
    expect(screen.queryByText('columns')).toBeNull();
  });

  it('SearchIndexFieldsTable should only show relevant field rows according to the searchedFields data', () => {
    render(
      <SearchIndexFieldsTable
        {...mockProps}
        searchedFields={mockSearchedFields}
      />
    );

    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.queryByText('columns')).toBeNull();
    expect(screen.queryByText('description')).toBeNull();
    expect(screen.queryByText('column_description')).toBeNull();
  });

  it('SearchIndexFieldsTable should show value from dataType field when there is no dataTypeDisplay is present', () => {
    render(
      <SearchIndexFieldsTable
        {...mockProps}
        searchedFields={mockSearchedFields}
      />
    );
    const dataTypeFieldForColumnName = screen.getByTestId('name-data-type');

    expect(dataTypeFieldForColumnName).toHaveTextContent('text');
  });
});
