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

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { SearchIndex } from '../../enums/search.enum';
import { ExploreQuickFilterField } from '../Explore/explore.interface';
import ExploreQuickFilters from './ExploreQuickFilters';

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
    .mockReturnValue(<div data-testid="search-dropdown">SearchDropdown</div>)
);

jest.mock('./AdvanceSearchModal.component', () => ({
  AdvanceSearchModal: jest.fn().mockReturnValue(<p>AdvanceSearchModal</p>),
}));

const index = SearchIndex.TABLE;
const fields = [
  { key: 'owner.name', value: undefined },
  { key: 'column_names', value: undefined },
] as ExploreQuickFilterField[];

const onFieldRemove = mockOnFieldRemove;
const onAdvanceSearch = mockOnAdvanceSearch;
const onClear = mockOnClear;
const onFieldValueSelect = mockOnFieldValueSelect;
const onFieldSelect = mockOnFieldSelect;
const onClearSelection = mockOnClearSelection;
const onUpdateFilterValues = mockOnUpdateFilterValues;

const mockProps = {
  index,
  fields,
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
    const { findAllByTestId } = render(<ExploreQuickFilters {...mockProps} />);

    const fields = await findAllByTestId('search-dropdown');

    expect(fields).toHaveLength(fields.length);
  });

  it('Should call onAdvanceSearch method on click of Advance Search button', async () => {
    const { findByTestId, findAllByTestId } = render(
      <ExploreQuickFilters {...mockProps} />
    );

    const fields = await findAllByTestId('search-dropdown');
    const advanceSearchButton = await findByTestId('advance-search-button');

    expect(fields).toHaveLength(fields.length);

    expect(advanceSearchButton).toBeInTheDocument();

    fireEvent.click(advanceSearchButton);

    expect(onAdvanceSearch).toBeCalled();
  });
});
