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
import { MemoryRouter } from 'react-router-dom';
import InputText from './InputText';

const mockFilter = {
  key: 'database',
  value: 'ecommerce_db',
};

const mockFilterRemoveHandler = jest.fn();
const mockFilterValueUpdateHandler = jest.fn();

const mockProp = {
  filter: mockFilter,
  index: 1,
  onFilterRemoveHandle: mockFilterRemoveHandler,
  onFilterValueUpdate: mockFilterValueUpdateHandler,
};

describe('Test InputText Component', () => {
  it('Should render all child elements', () => {
    const { getByTestId } = render(<InputText {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const filterInput = getByTestId('filter-input');
    const filterKey = getByTestId('filter-key');
    const removeButton = getByTestId('filter-remove-button');

    expect(filterInput).toBeInTheDocument();
    expect(filterKey).toBeInTheDocument();
    expect(removeButton).toBeInTheDocument();
  });

  it('Should call remove handler on click of remove button', () => {
    const { getByTestId } = render(<InputText {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const removeButton = getByTestId('filter-remove-button');

    expect(removeButton).toBeInTheDocument();

    fireEvent.mouseDown(removeButton);

    expect(mockFilterRemoveHandler).toBeCalled();
  });
});
