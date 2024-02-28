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

import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SearchIndex } from '../../enums/search.enum';
import { SearchDropdownProps } from '../SearchDropdown/SearchDropdown.interface';
import { ExploreQuickFilterField } from './ExplorePage.interface';
import ExploreQuickFilters from './ExploreQuickFilters';
import {
  mockAdvancedFieldDefaultOptions,
  mockAggregations,
} from './mocks/ExploreQuickFilters.mock';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useLocation: jest.fn().mockImplementation(() => ({ search: '' })),
  useParams: jest.fn().mockReturnValue({
    tab: 'tables',
  }),
}));

const mockOnFieldRemove = jest.fn();
const mockOnAdvanceSearch = jest.fn();
const mockOnClear = jest.fn();
const mockOnFieldValueSelect = jest.fn();
const mockOnFieldSelect = jest.fn();
const mockOnClearSelection = jest.fn();
const mockOnUpdateFilterValues = jest.fn();

jest.mock('../SearchDropdown/SearchDropdown', () =>
  jest
    .fn()
    .mockImplementation(
      ({ options, searchKey, onChange, onSearch }: SearchDropdownProps) => (
        <div
          data-testid={`search-dropdown-${searchKey}`}
          key={searchKey}
          title="search-dropdown">
          {options.map((option) => (
            <div data-testid={`option-${searchKey}`} key={option.key}>
              {option.label}
            </div>
          ))}
          <div
            data-testid={`onSearch-${searchKey}`}
            onClick={() => onSearch('e', searchKey)}>
            onSearch
          </div>
          <div
            data-testid={`onChange-${searchKey}`}
            onClick={() => onChange([{ key: '', label: '' }], searchKey)}>
            onChange
          </div>
        </div>
      )
    )
);

jest.mock('./AdvanceSearchModal.component', () => ({
  AdvanceSearchModal: jest.fn().mockReturnValue(<p>AdvanceSearchModal</p>),
}));

jest.mock('../../rest/miscAPI', () => ({
  getAggregateFieldOptions: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockAdvancedFieldDefaultOptions)),
}));

const index = SearchIndex.TABLE;
const mockFields: ExploreQuickFilterField[] = [
  {
    label: 'Column',
    key: 'columns.name',
    value: undefined,
  },
  {
    label: 'Schema',
    key: 'databaseSchema.name',
    value: undefined,
  },
  {
    label: 'Database',
    key: 'database.name',
    value: undefined,
  },
  {
    label: 'Owner',
    key: 'owner.displayName',
    value: undefined,
  },
  {
    label: 'Tag',
    key: 'tags.tagFQN',
    value: undefined,
  },
  {
    label: 'Service',
    key: 'service.name',
    value: undefined,
  },
];

const onFieldRemove = mockOnFieldRemove;
const onAdvanceSearch = mockOnAdvanceSearch;
const onClear = mockOnClear;
const onFieldValueSelect = mockOnFieldValueSelect;
const onFieldSelect = mockOnFieldSelect;
const onClearSelection = mockOnClearSelection;
const onUpdateFilterValues = mockOnUpdateFilterValues;

const mockProps = {
  index,
  fields: mockFields,
  aggregations: mockAggregations,
  onFieldRemove,
  onAdvanceSearch,
  onClear,
  onClearSelection,
  onFieldValueSelect,
  onFieldSelect,
  onUpdateFilterValues,
};

describe('Test ExploreQuickFilters component', () => {
  it('Should render ExploreQuickFilters component', async () => {
    const { findAllByTitle } = render(<ExploreQuickFilters {...mockProps} />);

    const fields = await findAllByTitle('search-dropdown');

    expect(fields).toHaveLength(fields.length);
  });

  it('All options should be passed to SearchDropdown component for proper API response', async () => {
    const { findByTestId, findAllByTestId } = render(
      <ExploreQuickFilters {...mockProps} />
    );

    const databaseFieldOnSearch = await findByTestId('onSearch-database.name');

    expect(databaseFieldOnSearch).toBeInTheDocument();

    await act(async () => {
      userEvent.click(databaseFieldOnSearch);
    });

    const options = await findAllByTestId('option-database.name');

    expect(options).toHaveLength(3);
  });
});
