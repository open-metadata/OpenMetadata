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

import { findByTestId, render } from '@testing-library/react';
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
      await findByTestId(container, 'confirmation-text')
    ).toBeInTheDocument();
  });

  it('Should initially render confirm button as disable component', async () => {
    const { container } = render(<EntityDeleteModal {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const confirmButton = await findByTestId(container, 'confirm-button');

    expect(confirmButton).toBeDisabled();
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
});
