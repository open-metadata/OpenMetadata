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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpandableConfig } from 'antd/lib/table/interface';
import React from 'react';
import { SearchIndexField } from '../../../generated/entity/data/searchIndex';
import { MOCK_SEARCH_INDEX_FIELDS } from '../../../mocks/SearchIndex.mock';
import SearchIndexFieldsTab from './SearchIndexFieldsTab';
import { SearchIndexFieldsTabProps } from './SearchIndexFieldsTab.interface';

const mockOnUpdate = jest.fn();
const mockOnThreadLinkSelect = jest.fn();

const mockProps: SearchIndexFieldsTabProps = {
  fields: MOCK_SEARCH_INDEX_FIELDS,
  onUpdate: mockOnUpdate,
  hasDescriptionEditAccess: true,
  hasTagEditAccess: true,
  isReadOnly: false,
  onThreadLinkSelect: mockOnThreadLinkSelect,
  entityFqn: 'search_service.search_index_fqn',
};

jest.mock('../../../components/common/searchbar/Searchbar', () =>
  jest
    .fn()
    .mockImplementation(({ onSearch }) => (
      <div onClick={() => onSearch('name')}>testSearchBar</div>
    ))
);

jest.mock('../../../components/ToggleExpandButton/ToggleExpandButton', () =>
  jest
    .fn()
    .mockImplementation(({ toggleExpandAll }) => (
      <div onClick={toggleExpandAll}>testToggleExpandButton</div>
    ))
);

jest.mock('../SearchIndexFieldsTable/SearchIndexFieldsTable', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        searchedFields,
        expandableConfig,
      }: {
        searchedFields: SearchIndexField[];
        expandableConfig: ExpandableConfig<SearchIndexField>;
      }) => (
        <>
          <div>testSearchIndexFieldsTable</div>
          {searchedFields.map((field) => (
            <p key={field.fullyQualifiedName}>{field.name}</p>
          ))}
          <p data-testid="expanded-rows">
            {expandableConfig.expandedRowKeys?.length}
          </p>
        </>
      )
    )
);

describe('SearchIndexFieldsTab component', () => {
  it('SearchIndexFieldsTab should pass all the fields to SearchIndexFieldsTable when not searched anything', () => {
    render(<SearchIndexFieldsTab {...mockProps} />);

    expect(screen.getByText('testSearchBar')).toBeInTheDocument();
    expect(screen.getByText('testToggleExpandButton')).toBeInTheDocument();
    expect(screen.getByText('testSearchIndexFieldsTable')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getByText('columns')).toBeInTheDocument();
  });

  it('SearchIndexFieldsTab should pass only filtered fields according to the search text', async () => {
    await act(async () => {
      render(<SearchIndexFieldsTab {...mockProps} />);
    });

    const searchBar = screen.getByText('testSearchBar');

    expect(searchBar).toBeInTheDocument();

    await act(async () => userEvent.click(searchBar));

    expect(screen.getByText('testSearchIndexFieldsTable')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.queryByText('description')).toBeNull();
    expect(screen.getByText('columns')).toBeInTheDocument();
  });

  it('expandedRowKeys should be updated with proper value on click of toggle button', async () => {
    await act(async () => {
      render(<SearchIndexFieldsTab {...mockProps} />);
    });

    const toggleExpandButton = screen.getByText('testToggleExpandButton');

    expect(toggleExpandButton).toBeInTheDocument();
    expect(screen.getByTestId('expanded-rows')).toHaveTextContent('0');

    await act(async () => userEvent.click(toggleExpandButton));

    expect(await screen.findByTestId('expanded-rows')).toHaveTextContent('1');
  });
});
