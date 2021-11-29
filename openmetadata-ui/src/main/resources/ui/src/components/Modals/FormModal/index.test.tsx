/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import {
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React from 'react';
import FormModal from '.';

const mockCancel = jest.fn();
const mockSave = jest.fn();
const mockForm = jest.fn().mockReturnValue(<p data-testid="form">data</p>);
const mockInitionalData = {
  name: '',
  description: '',
};

describe('Test FormModal component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <FormModal
        form={mockForm}
        header="Adding new users"
        initialData={mockInitionalData}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );
    const modalComponent = await findByTestId(container, 'modal-container');
    const header = await findByTestId(container, 'header');
    const form = await findByTestId(container, 'form');
    const ctaContainer = await findByTestId(container, 'cta-container');

    expect(ctaContainer.childElementCount).toBe(2);
    expect(modalComponent).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(form).toBeInTheDocument();
  });

  it('Onclick of Cancel button, onCancel callback should called', async () => {
    const { container } = render(
      <FormModal
        form={mockForm}
        header="Adding new users"
        initialData={mockInitionalData}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );
    const cancel = await findByText(container, /Cancel/i);
    fireEvent.click(cancel);

    expect(mockCancel).toBeCalledTimes(1);
  });

  it('Onclick of Save button, onSave callback should called', async () => {
    const { container } = render(
      <FormModal
        form={mockForm}
        header="Adding new users"
        initialData={mockInitionalData}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );
    const save = await findByText(container, /Save/i);
    fireEvent.click(save);

    expect(mockSave).toBeCalledTimes(1);
  });
});
