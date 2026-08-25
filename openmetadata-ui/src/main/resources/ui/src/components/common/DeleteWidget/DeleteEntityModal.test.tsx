/*
 *  Copyright 2025 Collate.
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
import { ReactNode } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { mockUserData } from '../../../mocks/MyDataPage.mock';
import { deleteEntity } from '../../../rest/miscAPI';
import DeleteEntityModal from './DeleteEntityModal';
import { DeleteWidgetModalProps } from './DeleteWidget.interface';

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

jest.mock('../../../rest/miscAPI', () => ({
  deleteEntity: jest.fn().mockImplementation(() =>
    Promise.resolve({
      status: 200,
      data: { version: 1 },
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
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../utils/i18next/LocalUtil', () => ({
  Transi18next: ({ children }: { children: ReactNode }) => children,
  t: jest.fn().mockImplementation((key: string) => key),
}));

describe('DeleteEntityModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render header, both options and action buttons without a text input', async () => {
    render(<DeleteEntityModal {...mockProps} />);

    expect(await screen.findByTestId('delete-modal')).toBeInTheDocument();
    expect(await screen.findByTestId('modal-header')).toBeInTheDocument();
    expect(await screen.findByTestId('soft-delete')).toBeInTheDocument();
    expect(await screen.findByTestId('hard-delete')).toBeInTheDocument();
    expect(await screen.findByTestId('discard-button')).toBeInTheDocument();
    expect(await screen.findByTestId('confirm-button')).toBeInTheDocument();
    expect(
      screen.queryByTestId('confirmation-text-input')
    ).not.toBeInTheDocument();
  });

  it('should confirm without requiring typed confirmation', async () => {
    render(<DeleteEntityModal {...mockProps} />);

    const confirmButton = await screen.findByTestId('confirm-button');

    expect(confirmButton).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(deleteEntity).toHaveBeenCalled();
  });

  it('should call onCancel when discard is clicked', async () => {
    render(<DeleteEntityModal {...mockProps} />);

    fireEvent.click(await screen.findByTestId('discard-button'));

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('should not logout when deleting a different user', async () => {
    render(<DeleteEntityModal {...mockPropsUser} entityId="456" />);

    fireEvent.click(await screen.findByTestId('hard-delete'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-button'));
    });

    expect(mockOnLogoutHandler).not.toHaveBeenCalled();
  });

  it('should logout when deleting the current user', async () => {
    render(<DeleteEntityModal {...mockPropsUser} />);

    fireEvent.click(await screen.findByTestId('hard-delete'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-button'));
    });

    expect(mockOnLogoutHandler).toHaveBeenCalled();
  });
});
