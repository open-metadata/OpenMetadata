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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DeleteWidgetModalProps } from './DeleteWidget.interface';
import DeleteWidgetModal from './DeleteWidgetModal';

const mockProps: DeleteWidgetModalProps = {
  visible: true,
  onCancel: jest.fn(),
  entityName: 'entityName',
  entityType: 'entityType',
  entityId: 'entityId',
};

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  startCase: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
}));

jest.mock('rest/miscAPI', () => ({
  deleteEntity: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

describe('Test DeleteWidgetV1 Component', () => {
  it('Component should render properly', async () => {
    await act(async () => {
      render(<DeleteWidgetModal {...mockProps} />);
    });

    const deleteModal = await screen.findByTestId('delete-modal');
    const footer = await screen.findByTestId('footer');
    const discardButton = await screen.findByTestId('discard-button');
    const confirmButton = await screen.findByTestId('confirm-button');
    const softDelete = await screen.findByTestId('soft-delete');
    const hardDelete = await screen.findByTestId('hard-delete');
    const inputBox = await screen.findByTestId('confirmation-text-input');

    expect(deleteModal).toBeInTheDocument();
    expect(footer).toBeInTheDocument();
    expect(discardButton).toBeInTheDocument();
    expect(confirmButton).toBeInTheDocument();
    expect(softDelete).toBeInTheDocument();
    expect(hardDelete).toBeInTheDocument();
    expect(inputBox).toBeInTheDocument();
  });

  it('Delete click should work properly', async () => {
    await act(async () => {
      render(<DeleteWidgetModal {...mockProps} />);

      const inputBox = await screen.findByTestId('confirmation-text-input');
      const confirmButton = await screen.findByTestId('confirm-button');
      const hardDelete = await screen.findByTestId('hard-delete');

      userEvent.click(hardDelete);

      userEvent.type(inputBox, 'DELETE');

      expect(confirmButton).not.toBeDisabled();

      userEvent.click(confirmButton);
    });
  });

  it('Discard click should work properly', async () => {
    await act(async () => {
      render(<DeleteWidgetModal {...mockProps} />);
      const discardButton = await screen.findByTestId('discard-button');

      userEvent.click(discardButton);

      expect(mockProps.onCancel).toHaveBeenCalled();
    });
  });
});
