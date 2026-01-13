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
import userEvent from '@testing-library/user-event';
import { EntityType } from '../../../enums/entity.enum';
import { mockUserData } from '../../../mocks/MyDataPage.mock';
import { DeleteWidgetModalProps } from './DeleteWidget.interface';
import DeleteWidgetModal from './DeleteWidgetModal';

const mockProps: DeleteWidgetModalProps = {
  visible: true,
  onCancel: jest.fn(),
  entityName: 'entityName',
  entityType: EntityType.TABLE,
  entityId: 'entityId',
};

const mockPropsUser: DeleteWidgetModalProps = {
  visible: true,
  onCancel: jest.fn(),
  entityName: 'entityName',
  entityType: EntityType.USER,
  entityId: mockUserData.id,
};

const mockOnLogoutHandler = jest.fn();

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  startCase: jest.fn(),
}));

jest.mock('../../../rest/miscAPI', () => ({
  deleteEntity: jest.fn().mockImplementation(() =>
    Promise.resolve({
      status: 200,
    })
  ),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock('../../Auth/AuthProviders/AuthProvider', () => ({
  useAuthProvider: jest.fn().mockImplementation(() => ({
    onLogoutHandler: mockOnLogoutHandler,
  })),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
}));

describe('Test DeleteWidgetV1 Component', () => {
  it('Component should render properly', async () => {
    render(<DeleteWidgetModal {...mockProps} />);

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
    render(<DeleteWidgetModal {...mockProps} />);

    const inputBox = await screen.findByTestId('confirmation-text-input');
    const confirmButton = await screen.findByTestId('confirm-button');
    const hardDelete = await screen.findByTestId('hard-delete');

    fireEvent.click(hardDelete);

    fireEvent.change(inputBox, { target: { value: 'DELETE' } });

    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);
  });

  it('Delete click should work properly regardless of capitalization', async () => {
    render(<DeleteWidgetModal {...mockProps} />);

    const inputBox = await screen.findByTestId('confirmation-text-input');
    const confirmButton = await screen.findByTestId('confirm-button');
    const hardDelete = await screen.findByTestId('hard-delete');

    fireEvent.click(hardDelete);

    fireEvent.change(inputBox, { target: { value: 'delete' } });

    expect(confirmButton).not.toBeDisabled();

    userEvent.click(confirmButton);
  });

  it('Discard click should work properly', async () => {
    render(<DeleteWidgetModal {...mockProps} />);
    const discardButton = await screen.findByTestId('discard-button');

    fireEvent.click(discardButton);

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('onLogoutHandler should not be called if entityType is user and EntityId and CurrentUser id is different', async () => {
    render(<DeleteWidgetModal {...mockPropsUser} entityId="456" />);

    const confirmButton = screen.getByTestId('confirm-button');

    fireEvent.click(screen.getByTestId('hard-delete'));

    fireEvent.change(screen.getByTestId('confirmation-text-input'), {
      target: { value: 'DELETE' },
    });

    expect(confirmButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(mockOnLogoutHandler).not.toHaveBeenCalled();
  });

  it('onLogoutHandler should be called if entityType is user and EntityId and CurrentUser id is same', async () => {
    render(<DeleteWidgetModal {...mockPropsUser} />);

    const confirmButton = screen.getByTestId('confirm-button');

    fireEvent.click(screen.getByTestId('hard-delete'));

    fireEvent.change(screen.getByTestId('confirmation-text-input'), {
      target: { value: 'DELETE' },
    });

    expect(confirmButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(mockOnLogoutHandler).toHaveBeenCalled();
  });
});
