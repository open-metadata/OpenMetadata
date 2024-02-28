/*
 *  Copyright 2024 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import AddDataProductModal from './AddDataProductModal.component';

const formData = {
  description: 'test-description',
  name: 'test-name',
};

const mockSubmit = jest.fn();
const mockCancel = jest.fn();
const mockSave = jest.fn();

const mockProps = {
  open: true,
  onSubmit: mockSubmit,
  onCancel: mockCancel,
};

jest.mock('../AddDomainForm/AddDomainForm.component', () => {
  return jest.fn().mockImplementation(({ onSubmit }) => (
    <div>
      AddDomainForm
      <button data-testid="submit-button" onClick={() => onSubmit(formData)}>
        Submit
      </button>
    </div>
  ));
});

jest.mock('antd/lib/form/Form', () => ({
  useForm: () => [
    {
      submit: mockSave,
    },
  ],
}));

describe('Test AddDataProductModal Component', () => {
  it('Should Render Add Data Product Modal Component', async () => {
    render(<AddDataProductModal {...mockProps} />);

    expect(await screen.findByText('label.add-entity')).toBeInTheDocument();
    expect(await screen.findByText('AddDomainForm')).toBeInTheDocument();
    expect(await screen.findByText('label.cancel')).toBeInTheDocument();
    expect(await screen.findByText('label.save')).toBeInTheDocument();
  });

  it('Should call onSubmit function', async () => {
    render(<AddDataProductModal {...mockProps} />);

    const submitButton = await screen.findByTestId('submit-button');
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mockSubmit).toHaveBeenCalledWith(formData);
  });

  it('should call form.submit when save button is clicked', async () => {
    await act(async () => {
      render(<AddDataProductModal {...mockProps} />);
    });
    const button = await screen.findByTestId('save-data-product');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockSave).toHaveBeenCalled();
  });
});
