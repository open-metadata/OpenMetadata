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

jest.mock('./ExploreQuickFilter', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="advanced-field">ExploreQuickFilter</div>)
);

jest.mock('./AdvanceSearchModal.component', () => ({
  AdvanceSearchModal: jest.fn().mockReturnValue(<p>AdvanceSearchModal</p>),
}));

const index = SearchIndex.TABLE;
const fields = [
  { key: 'owner.name', value: undefined },
  { key: 'column_names', value: undefined },
] as ExploreQuickFilterField[];

const onFieldRemove = jest.fn();
const onAdvanceSearch = jest.fn();
const onClear = jest.fn();
const onFieldValueSelect = jest.fn();
const onFieldSelect = jest.fn();

const mockProps = {
  index,
  fields,
  onFieldRemove,
  onAdvanceSearch,
  onClear,
  onFieldValueSelect,
  onFieldSelect,
};

describe('Test ExploreQuickFilters component', () => {
  it('Should render ExploreQuickFilters component', async () => {
    const { findByTestId, findAllByTestId } = render(
      <ExploreQuickFilters {...mockProps} />
    );

    const fields = await findAllByTestId('advanced-field');
    const clearButton = await findByTestId('clear-all-button');

    expect(fields).toHaveLength(fields.length);

    expect(clearButton).toBeInTheDocument();
  });

  it('Should call onClear method on click of Clear All button', async () => {
    const { findByTestId, findAllByTestId } = render(
      <ExploreQuickFilters {...mockProps} />
    );

    const fields = await findAllByTestId('advanced-field');
    const clearButton = await findByTestId('clear-all-button');

    expect(fields).toHaveLength(fields.length);

    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);

    expect(onClear).toBeCalledWith();
  });

  it('Should call onAdvanceSearch method on click of Advance Search button', async () => {
    const { findByTestId, findAllByTestId } = render(
      <ExploreQuickFilters {...mockProps} />
    );

    const fields = await findAllByTestId('advanced-field');
    const advanceSearchButton = await findByTestId('advance-search-button');

    expect(fields).toHaveLength(fields.length);

    expect(advanceSearchButton).toBeInTheDocument();

    fireEvent.click(advanceSearchButton);

    expect(onAdvanceSearch).toBeCalled();
  });
});
