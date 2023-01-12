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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import ConfirmationModal from './ConfirmationModal';

const mockConfirmation = jest.fn();
const mockCancel = jest.fn();

describe('Test Ingestion modal component', () => {
  it('Component Should render', async () => {
    await act(async () => {
      render(
        <ConfirmationModal
          visible
          bodyText="Are you sure?"
          cancelText="Cancel"
          confirmText="Save"
          header="confirmation modal"
          onCancel={mockCancel}
          onConfirm={mockConfirmation}
        />
      );
    });

    const confirmationModal = await screen.findByTestId('confirmation-modal');
    const header = await screen.findByTestId('modal-header');
    const bodyText = await screen.findByTestId('body-text');
    const cancel = await screen.findByTestId('cancel');
    const save = await screen.findByTestId('save-button');

    expect(confirmationModal).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(header.textContent).toBe('confirmation modal');
    expect(bodyText).toBeInTheDocument();
    expect(bodyText.textContent).toBe('Are you sure?');
    expect(cancel).toBeInTheDocument();
    expect(cancel.textContent).toBe('Cancel');
    expect(save).toBeInTheDocument();
    expect(save.textContent).toBe('Save');

    fireEvent.click(cancel);

    expect(mockCancel).toHaveBeenCalled();

    fireEvent.click(save);

    expect(mockConfirmation).toHaveBeenCalled();
  });

  it('If loading state is waiting, component should show loading indicator', async () => {
    await act(async () => {
      render(
        <ConfirmationModal
          visible
          bodyClassName=""
          bodyText="Are you sure?"
          cancelButtonCss=""
          cancelText="Cancel"
          confirmButtonCss=""
          confirmText="Save"
          footerClassName=""
          header="confirmation modal"
          headerClassName=""
          loadingState="waiting"
          onCancel={mockCancel}
          onConfirm={mockConfirmation}
        />
      );
    });

    const loader = await screen.findByTestId('loading-button');

    expect(loader).toBeInTheDocument();
  });
});
