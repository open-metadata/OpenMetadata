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
import { act, fireEvent, render } from '@testing-library/react';
import DomainTypeSelectForm from './DomainTypeSelectForm.component';

// Mock the onSubmit and onCancel functions
const mockOnSubmit = jest.fn();
const mockOnCancel = jest.fn();

const defaultProps = {
  defaultValue: 'Aggregate',
  onSubmit: mockOnSubmit,
  onCancel: mockOnCancel,
};

describe('DomainTypeSelectForm', () => {
  it('calls onSubmit when the form is submitted', async () => {
    const { getByTestId } = render(<DomainTypeSelectForm {...defaultProps} />);
    const saveButton = getByTestId('saveAssociatedTag');

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockOnSubmit).toHaveBeenCalledWith('Aggregate');
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const { getByTestId } = render(<DomainTypeSelectForm {...defaultProps} />);
    const cancelButton = getByTestId('cancelAssociatedTag');

    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });
});
