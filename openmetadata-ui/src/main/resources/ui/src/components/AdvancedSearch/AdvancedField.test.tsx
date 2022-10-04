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
import { SuggestResponse } from '../../interface/search.interface';
import { AdvanceField } from '../Explore/explore.interface';
import AdvancedField from './AdvancedField';

const mockUserData: SuggestResponse<SearchIndex.USER> = [
  {
    text: 'Aaron Johnson',
    _index: SearchIndex.USER,
    _id: '2cae227c-e2c4-487c-b52c-a96ae242d90d',
    _source: {
      id: '2cae227c-e2c4-487c-b52c-a96ae242d90d',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      version: 0.1,
      updatedAt: 1661336540995,
      updatedBy: 'anonymous',
      email: 'aaron_johnson0@gmail.com',
      href: 'http://localhost:8585/api/v1/users/2cae227c-e2c4-487c-b52c-a96ae242d90d',
      isAdmin: false,
      teams: [],
      deleted: false,
      roles: [],
      inheritedRoles: [],
      entityType: 'user',
      type: 'user',
    },
  },
];

jest.mock('../../axiosAPIs/searchAPI', () => ({
  suggestQuery: jest
    .fn()
    .mockImplementation(
      (): Promise<SuggestResponse<SearchIndex>> => Promise.resolve(mockUserData)
    ),
}));

const index = SearchIndex.TABLE;
const field = { key: 'owner.name', value: undefined } as AdvanceField;
const onFieldRemove = jest.fn();
const onFieldValueSelect = jest.fn();

const mockProps = {
  index,
  field,
  onFieldRemove,
  onFieldValueSelect,
};

describe('Test AdvancedField Component', () => {
  it('Should render advancedfield component', async () => {
    const { findByTestId } = render(<AdvancedField {...mockProps} />);

    const label = await findByTestId('field-label');

    expect(label).toBeInTheDocument();

    expect(label).toHaveTextContent('Owner:');

    const searchSelect = await findByTestId('field-select');

    expect(searchSelect).toBeInTheDocument();

    const removeButton = await findByTestId('field-remove-button');

    expect(removeButton).toBeInTheDocument();
  });

  it('Should call remove method on click of remove button', async () => {
    const { findByTestId } = render(<AdvancedField {...mockProps} />);

    const label = await findByTestId('field-label');

    expect(label).toBeInTheDocument();

    expect(label).toHaveTextContent('Owner:');

    const searchSelect = await findByTestId('field-select');

    expect(searchSelect).toBeInTheDocument();

    const removeButton = await findByTestId('field-remove-button');

    expect(removeButton).toBeInTheDocument();

    fireEvent.click(removeButton);

    expect(onFieldRemove).toHaveBeenCalledWith(field.key);
  });

  it('Should call select method on click of option', async () => {
    const { findByTestId, findByRole, findAllByTestId } = render(
      <AdvancedField {...mockProps} />
    );

    const label = await findByTestId('field-label');

    expect(label).toBeInTheDocument();

    expect(label).toHaveTextContent('Owner:');

    const searchSelect = await findByTestId('field-select');

    expect(searchSelect).toBeInTheDocument();

    const removeButton = await findByTestId('field-remove-button');

    expect(removeButton).toBeInTheDocument();

    const searchInput = await findByRole('combobox');

    expect(searchInput).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'cloud' } });

    const fieldOptions = await findAllByTestId('field-option');

    expect(fieldOptions).toHaveLength(mockUserData.length);

    fireEvent.click(fieldOptions[0]);

    expect(onFieldValueSelect).toHaveBeenCalledWith({
      key: 'owner.name',
      value: 'aaron_johnson0',
    });
  });
});
