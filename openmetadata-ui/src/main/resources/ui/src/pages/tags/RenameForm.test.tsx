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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import RenameForm from './RenameForm';

const mockCancel = jest.fn();
const mockSubmit = jest.fn();

const MOCK_PROPS = {
  visible: true,
  onCancel: mockCancel,
  isSaveButtonDisabled: false,
  header: 'Rename Tag',
  initialValues: { name: 'test' },
  onSubmit: mockSubmit,
};

describe('RenameForm component', () => {
  it('Rename Modal component should render properly', async () => {
    render(<RenameForm {...MOCK_PROPS} />);

    const modal = await screen.findByTestId('modal-container');

    const modalTitle = await screen.findByText(MOCK_PROPS.header);

    const cancelButton = await screen.findByText('Cancel');
    const submitButton = await screen.findByText('label.ok');

    expect(modal).toBeInTheDocument();
    expect(modalTitle).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
  });

  it('Callback on button click should work', async () => {
    render(<RenameForm {...MOCK_PROPS} />);
    const cancelButton = await screen.findByText('Cancel');

    fireEvent.click(cancelButton);

    expect(mockCancel).toHaveBeenCalledTimes(1);
  });
});
