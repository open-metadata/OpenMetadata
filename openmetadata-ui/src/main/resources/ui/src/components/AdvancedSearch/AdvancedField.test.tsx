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
import { AdvanceField } from '../Explore/explore.interface';
import AdvancedField from './AdvancedField';

const mockData = {
  'metadata-suggest': [
    {
      text: 'clou',
      offset: 0,
      length: 4,
      options: [
        {
          text: 'Cloud_Infra',
          _index: 'team_search_index',
          _type: '_doc',
          _id: '267a4dd4-df64-400d-b4d1-3925d6f23885',
          _score: 10,
          _source: {
            suggest: [
              {
                input: 'Cloud_Infra',
                weight: 5,
              },
              {
                input: 'Cloud_Infra',
                weight: 10,
              },
            ],
            deleted: false,
            // eslint-disable-next-line @typescript-eslint/camelcase
            team_id: '267a4dd4-df64-400d-b4d1-3925d6f23885',
            name: 'Cloud_Infra',
            // eslint-disable-next-line @typescript-eslint/camelcase
            display_name: 'Cloud_Infra',
            // eslint-disable-next-line @typescript-eslint/camelcase
            entity_type: 'team',
            users: [],
            owns: [],
            // eslint-disable-next-line @typescript-eslint/camelcase
            default_roles: [],
            // eslint-disable-next-line @typescript-eslint/camelcase
            last_updated_timestamp: 1654838173854,
          },
        },
      ],
    },
  ],
};

jest.mock('../../axiosAPIs/miscAPI', () => ({
  getAdvancedFieldOptions: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  getUserSuggestions: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: { suggest: mockData } })),
}));

const index = 'table_search_index';
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

    expect(fieldOptions).toHaveLength(
      mockData['metadata-suggest'][0].options.length
    );

    fireEvent.click(fieldOptions[0]);

    expect(onFieldValueSelect).toHaveBeenCalledWith({
      key: 'owner.name',
      value: 'Cloud_Infra',
    });
  });
});
