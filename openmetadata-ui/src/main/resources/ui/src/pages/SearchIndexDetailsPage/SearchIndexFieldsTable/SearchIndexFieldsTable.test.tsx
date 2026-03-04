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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MOCK_SEARCH_INDEX_FIELDS } from '../../../mocks/SearchIndex.mock';
import SearchIndexFieldsTable from './SearchIndexFieldsTable';

const mockOnUpdate = jest.fn();

const mockProps = {
  fieldAllRowKeys: [],
  searchIndexFields: MOCK_SEARCH_INDEX_FIELDS,
  onUpdate: mockOnUpdate,
  hasDescriptionEditAccess: true,
  hasTagEditAccess: true,
  hasGlossaryTermEditAccess: true,
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
  '../../../components/common/ErrorWithPlaceholder/FilterTablePlaceHolder',
  () =>
    jest.fn().mockImplementation(() => <div>testFilterTablePlaceHolder</div>)
);

jest.mock(
  '../../../components/Customization/GenericProvider/GenericProvider',
  () => ({
    useGenericContext: jest.fn().mockReturnValue({
      type: 'searchIndex',
      setDisplayedColumns: jest.fn(),
    }),
  })
);

jest.mock(
  '../../../components/Database/TableDescription/TableDescription.component',
  () => jest.fn().mockImplementation(() => <div>testTableDescription</div>)
);

jest.mock('../../../components/Database/TableTags/TableTags.component', () =>
  jest.fn().mockImplementation(() => <div>testTableTags</div>)
);

jest.mock(
  '../../../components/common/ToggleExpandButton/ToggleExpandButton',
  () =>
    jest
      .fn()
      .mockImplementation(({ toggleExpandAll }) => (
        <div onClick={toggleExpandAll}>testToggleExpandButton</div>
      ))
);

jest.mock(
  '../../../components/common/SearchBarComponent/SearchBar.component',
  () => jest.fn().mockImplementation(() => <div>SearchBar</div>)
);

jest.mock(
  '../../../components/Database/ColumnDetailPanel/ColumnDetailPanel.component',
  () => ({
    ColumnDetailPanel: jest
      .fn()
      .mockImplementation(() => <div data-testid="column-detail-panel" />),
  })
);

jest.mock(
  '../../../components/Database/ColumnFilter/ColumnFilter.component',
  () => ({
    ColumnFilter: jest
      .fn()
      .mockImplementation(() => <div data-testid="column-filter" />),
  })
);

jest.mock(
  '../../../components/common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider',
  () => ({
    EntityAttachmentProvider: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
  })
);

jest.mock('../../../utils/TableUtils', () => {
  const actual = jest.requireActual('../../../utils/TableUtils');

  return {
    ...actual,
    searchInFields: jest.fn().mockReturnValue(MOCK_SEARCH_INDEX_FIELDS),
    updateFieldDescription: jest.fn(),
    updateFieldTags: jest.fn(),
    getTableExpandableConfig: jest.fn().mockReturnValue({}),
    getTableColumnConfigSelections: jest
      .fn()
      .mockReturnValue([
        'name',
        'description',
        'dataTypeDisplay',
        'tags',
        'glossary',
      ]),
    handleUpdateTableColumnSelections: jest.fn(),
  };
});

jest.mock('../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest
    .fn()
    .mockImplementation((_entityType, fqn) => `/searchIndex/${fqn}`),
}));

describe('SearchIndexFieldsTable component', () => {
  it('SearchIndexFieldsTable should render a table with proper data', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SearchIndexFieldsTable {...mockProps} />
        </MemoryRouter>
      );
    });

    expect(screen.getByText('testToggleExpandButton')).toBeInTheDocument();
    expect(screen.getByTestId('search-index-fields-table')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('columns')).toBeInTheDocument();
  });

  it('SearchIndexFieldsTable should not display data if fields data is empty', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SearchIndexFieldsTable
            {...mockProps}
            isReadOnly={false}
            searchIndexFields={[]}
          />
        </MemoryRouter>
      );
    });

    expect(screen.getByTestId('search-index-fields-table')).toBeInTheDocument();
    expect(screen.queryByText('name')).toBeNull();
    expect(screen.queryByText('columns')).toBeNull();
  });

  it('SearchIndexFieldsTable should only show relevant field rows according to the searchedFields data', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SearchIndexFieldsTable
            {...mockProps}
            searchIndexFields={mockSearchedFields}
          />
        </MemoryRouter>
      );
    });

    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.queryByText('columns')).toBeNull();
    expect(screen.queryByText('description')).toBeNull();
    expect(screen.queryByText('column_description')).toBeNull();
  });

  it('SearchIndexFieldsTable should show value from dataType field when there is no dataTypeDisplay is present', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SearchIndexFieldsTable
            {...mockProps}
            searchIndexFields={mockSearchedFields}
          />
        </MemoryRouter>
      );
    });

    const dataTypeFieldForColumnName = screen.getByTestId('name-data-type');

    expect(dataTypeFieldForColumnName).toHaveTextContent('text');
  });

  it('Should render copy field link button for each field', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SearchIndexFieldsTable {...mockProps} />
        </MemoryRouter>
      );
    });

    const copyButtons = await screen.findAllByTestId('copy-field-link-button');

    expect(copyButtons.length).toBeGreaterThan(0);
  });

  it('Should copy field link to clipboard when copy button is clicked', async () => {
    const mockWriteText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <SearchIndexFieldsTable {...mockProps} />
        </MemoryRouter>
      );
    });

    const copyButtons = await screen.findAllByTestId('copy-field-link-button');

    await act(async () => {
      fireEvent.click(copyButtons[0]);
    });

    expect(mockWriteText).toHaveBeenCalled();
  });
});
