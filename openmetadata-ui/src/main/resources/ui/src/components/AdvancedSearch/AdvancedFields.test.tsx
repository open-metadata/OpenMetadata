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
import AdvancedFields from './AdvancedFields';

jest.mock('./AdvancedField', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="advanced-field">AdvancedField</div>)
);

const index = 'table_search_index';
const fields = [
  { key: 'owner.name', value: undefined },
  { key: 'column_names', value: undefined },
] as AdvanceField[];

const onFieldRemove = jest.fn();
const onClear = jest.fn();
const onFieldValueSelect = jest.fn();

const mockProps = {
  index,
  fields,
  onFieldRemove,
  onClear,
  onFieldValueSelect,
};

describe('Test AdvancedFields component', () => {
  it('Should render AdvancedFields component', async () => {
    const { findByTestId, findAllByTestId } = render(
      <AdvancedFields {...mockProps} />
    );

    const fields = await findAllByTestId('advanced-field');
    const clearButton = await findByTestId('clear-all-button');

    expect(fields).toHaveLength(fields.length);

    expect(clearButton).toBeInTheDocument();
  });

  it('Should call onClear method on click of Clear All button', async () => {
    const { findByTestId, findAllByTestId } = render(
      <AdvancedFields {...mockProps} />
    );

    const fields = await findAllByTestId('advanced-field');
    const clearButton = await findByTestId('clear-all-button');

    expect(fields).toHaveLength(fields.length);

    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);

    expect(onClear).toBeCalled();
  });
});
