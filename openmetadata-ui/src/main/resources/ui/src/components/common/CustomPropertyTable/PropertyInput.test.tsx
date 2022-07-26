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
import { PropertyInput } from './PropertyInput';

const onCancel = jest.fn();
const onSave = jest.fn();

const mockProp = {
  value: 'yValue',
  type: 'string',
  propertyName: 'yNumber',
  onCancel,
  onSave,
};

describe('Test PropertyInput Component', () => {
  it('Should render input component', async () => {
    const { findByTestId } = render(<PropertyInput {...mockProp} />);

    const valueInput = await findByTestId('value-input');
    const cancelButton = await findByTestId('cancel-value');
    const saveButton = await findByTestId('save-value');

    expect(valueInput).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();
  });

  it('Should call onCancel on click of cancel button', async () => {
    const { findByTestId } = render(<PropertyInput {...mockProp} />);

    const valueInput = await findByTestId('value-input');
    const cancelButton = await findByTestId('cancel-value');
    const saveButton = await findByTestId('save-value');

    expect(valueInput).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();

    fireEvent.mouseDown(cancelButton);

    expect(onCancel).toBeCalled();
  });

  it('Should call onSave on click of save button', async () => {
    const { findByTestId } = render(<PropertyInput {...mockProp} />);

    const valueInput = await findByTestId('value-input');
    const cancelButton = await findByTestId('cancel-value');
    const saveButton = await findByTestId('save-value');

    expect(valueInput).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();

    fireEvent.click(saveButton);

    expect(onSave).toBeCalled();
  });
});
