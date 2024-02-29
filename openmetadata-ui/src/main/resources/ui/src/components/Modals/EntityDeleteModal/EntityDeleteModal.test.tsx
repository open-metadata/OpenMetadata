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
import { MemoryRouter } from 'react-router-dom';
import EntityDeleteModal from './EntityDeleteModal';

const onCancel = jest.fn();
const onConfirm = jest.fn();

const mockProp = {
  loadingState: 'initial',
  entityName: 'zyx',
  entityType: 'table',
  onCancel,
  onConfirm,
  visible: false,
};

jest.mock('react-i18next', () => ({
  Trans: jest.fn().mockImplementation(() => <div>Trans</div>),
}));

describe('Test EntityDelete Modal Component', () => {
  it('Should render component', async () => {
    await act(async () => {
      render(<EntityDeleteModal {...mockProp} visible />);
    });

    expect(
      await screen.findByTestId('delete-confirmation-modal')
    ).toBeInTheDocument();

    expect(await screen.findByTestId('modal-header')).toBeInTheDocument();

    expect(await screen.findByTestId('body-text')).toBeInTheDocument();

    expect(
      await screen.findByTestId('confirmation-text-input')
    ).toBeInTheDocument();
  });

  it('Should initially render confirm button as disable', async () => {
    await act(async () => {
      render(<EntityDeleteModal {...mockProp} visible />, {
        wrapper: MemoryRouter,
      });
    });

    const confirmButton = await screen.findByTestId('confirm-button');

    expect(confirmButton).toBeDisabled();
  });

  it('Confirm button should be enable if confirm text matches', async () => {
    await act(async () => {
      render(<EntityDeleteModal {...mockProp} visible />, {
        wrapper: MemoryRouter,
      });
    });

    const confirmButton = await screen.findByTestId('confirm-button');

    expect(confirmButton).toBeDisabled();

    const inputBox = await screen.findByTestId('confirmation-text-input');

    fireEvent.change(inputBox, {
      target: { value: 'DELETE' },
    });

    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalled();
  });

  it('Should call onCancel on click of discard button', async () => {
    await act(async () => {
      render(<EntityDeleteModal {...mockProp} visible />, {
        wrapper: MemoryRouter,
      });
    });

    const discardButton = await screen.findByTestId('discard-button');

    fireEvent.click(discardButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('should show soft delete label in case of soft delete', async () => {
    await act(async () => {
      render(<EntityDeleteModal {...mockProp} softDelete visible />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findByText('label.soft-delete')).toBeInTheDocument();
  });
});
