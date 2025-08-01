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

import { fireEvent, render, screen } from '@testing-library/react';
import { PropertyInput, PropertyInputProps } from './PropertyInput';

const onCancel = jest.fn();
const onSave = jest.fn();

const mockProp: PropertyInputProps = {
  value: 'yValue',
  type: 'text',
  propertyName: 'yNumber',
  onCancel,
  onSave,
  isLoading: false,
};

jest.mock('../InlineEdit/InlineEdit.component', () => {
  return jest.fn().mockImplementation(({ children, onSave }) => (
    <div data-testid="inline-edit">
      {children}
      <button data-testid="save" onClick={onSave}>
        save
      </button>
    </div>
  ));
});

describe('Test PropertyInput Component', () => {
  it('Should render input component', async () => {
    render(<PropertyInput {...mockProp} />);

    const valueInput = await screen.findByTestId('value-input');
    const inlineEdit = await screen.findByTestId('inline-edit');

    expect(valueInput).toBeInTheDocument();
    expect(inlineEdit).toBeInTheDocument();
  });

  it('onSave should be called with updated value', async () => {
    const input = 'test';
    render(<PropertyInput {...mockProp} />);
    const valueInput = await screen.findByTestId('value-input');
    const saveBtn = await screen.findByTestId('save');

    expect(valueInput).toBeInTheDocument();
    expect(valueInput).toHaveValue('yValue');

    fireEvent.change(valueInput, { target: { value: input } });

    fireEvent.click(saveBtn);

    expect(mockProp.onSave).toHaveBeenCalledWith(input);
  });
});
