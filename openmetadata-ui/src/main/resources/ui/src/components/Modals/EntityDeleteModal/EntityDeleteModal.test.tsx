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

import { findByTestId, fireEvent, render } from '@testing-library/react';
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
};

describe('Test EntityDelete Modal Component', () => {
  it('Should render component', async () => {
    const { container } = render(<EntityDeleteModal {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    expect(
      await findByTestId(container, 'delete-confirmation-modal')
    ).toBeInTheDocument();

    expect(await findByTestId(container, 'modal-header')).toBeInTheDocument();

    expect(await findByTestId(container, 'body-text')).toBeInTheDocument();

    expect(
      await findByTestId(container, 'confirmation-text-input')
    ).toBeInTheDocument();
  });

  it('Should initially render confirm button as disable', async () => {
    const { container } = render(<EntityDeleteModal {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const confirmButton = await findByTestId(container, 'confirm-button');

    expect(confirmButton).toBeDisabled();
  });

  it('Should render discard button and input box as disable if loading state is wating', async () => {
    const { container } = render(
      <EntityDeleteModal {...mockProp} loadingState="waiting" />,
      {
        wrapper: MemoryRouter,
      }
    );

    const discardButton = await findByTestId(container, 'discard-button');
    const inputBox = await findByTestId(container, 'confirmation-text-input');

    expect(discardButton).toBeDisabled();
    expect(inputBox).toBeDisabled();
  });

  it('Should show loading button if loading state is waiting', async () => {
    const { container } = render(
      <EntityDeleteModal {...mockProp} loadingState="waiting" />,
      {
        wrapper: MemoryRouter,
      }
    );

    const loadingButton = await findByTestId(container, 'loading-button');

    expect(loadingButton).toBeDisabled();
  });

  it('Confirm button should be enable if confirm text matches', async () => {
    const { container } = render(<EntityDeleteModal {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const confirmButton = await findByTestId(container, 'confirm-button');

    expect(confirmButton).toBeDisabled();

    const inputBox = await findByTestId(container, 'confirmation-text-input');

    fireEvent.change(inputBox, {
      target: { value: 'DELETE' },
    });

    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalled();
  });

  it('Should call onCancel on click of discard button', async () => {
    const { container } = render(<EntityDeleteModal {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const discardButton = await findByTestId(container, 'discard-button');

    fireEvent.click(discardButton);

    expect(onCancel).toHaveBeenCalled();
  });
});
