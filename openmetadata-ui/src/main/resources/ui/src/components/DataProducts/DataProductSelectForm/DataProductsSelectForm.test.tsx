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
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import DataProductsSelectForm from './DataProductsSelectForm';

const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

describe('Data Products Form Page', () => {
  it('renders without errors', () => {
    const { getByTestId } = render(
      <DataProductsSelectForm
        defaultValue={[]}
        fetchApi={() => Promise.resolve({ data: [], paging: { total: 0 } })}
        placeholder="Select products"
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
      />
    );

    // Ensure that the component renders without errors
    expect(getByTestId('data-product-selector')).toBeInTheDocument();
  });

  it('calls onCancel function when Cancel button is clicked', () => {
    const { getByTestId } = render(
      <DataProductsSelectForm
        defaultValue={[]}
        fetchApi={() => Promise.resolve({ data: [], paging: { total: 0 } })}
        placeholder="Select products"
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
      />
    );

    const cancelButton = getByTestId('cancelAssociatedTag');
    userEvent.click(cancelButton);

    // Ensure that the onCancel function is called when the Cancel button is clicked
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmit when the Save button is clicked', () => {
    const { getByTestId } = render(
      <DataProductsSelectForm
        defaultValue={[]}
        fetchApi={() => Promise.resolve({ data: [], paging: { total: 0 } })}
        placeholder="Select products"
        onCancel={mockOnCancel}
        onSubmit={mockOnSubmit}
      />
    );
    const selectRef = getByTestId('data-product-selector').querySelector(
      '.ant-select-selector'
    );
    if (selectRef) {
      userEvent.click(selectRef);
    }

    // Simulate the Save button click
    userEvent.click(getByTestId('saveAssociatedTag'));

    // Check if onSubmit was called with the selected value
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
    expect(mockOnSubmit).toHaveBeenCalledWith(expect.any(Array));
  });
});
