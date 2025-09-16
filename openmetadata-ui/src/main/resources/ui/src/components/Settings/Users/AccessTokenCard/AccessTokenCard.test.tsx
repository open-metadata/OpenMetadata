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
import '@testing-library/jest-dom/extend-expect';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { revokeAccessToken } from '../../../../rest/userAPI';
import { mockAccessData } from '../mocks/User.mocks';
import AccessTokenCard from './AccessTokenCard.component';

jest.mock('../../Bot/BotDetails/AuthMechanism', () => {
  return jest.fn().mockImplementation(({ onTokenRevoke }) => (
    <p>
      AuthMechanism{' '}
      <button data-testid="open-modal-button" onClick={onTokenRevoke}>
        open
      </button>
    </p>
  ));
});

jest.mock('../../Bot/BotDetails/AuthMechanismForm', () => {
  return jest.fn().mockReturnValue(<p>AuthMechanismForm</p>);
});

jest.mock('../../../Modals/ConfirmationModal/ConfirmationModal', () => {
  return jest.fn().mockImplementation(({ onConfirm, onCancel, visible }) =>
    visible ? (
      <div data-testid="confirmation-modal">
        <button data-testid="cancel-button" onClick={onCancel}>
          Cancel
        </button>
        <button data-testid="confirm-button" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    ) : (
      <div data-testid="closed-confirmation-modal" />
    )
  );
});

jest.mock('../../../../rest/userAPI', () => {
  return {
    getUserAccessToken: jest
      .fn()
      .mockImplementation(() => Promise.resolve([mockAccessData])),
    updateUserAccessToken: jest.fn().mockImplementation(() =>
      Promise.resolve({
        JWTTokenExpiry: 'tesst',
        tokenName: 'test',
      })
    ),
    revokeAccessToken: jest.fn().mockImplementation(() => Promise.resolve()),
  };
});

describe('AccessTokenCard Component', () => {
  it('should render initial state with AuthMechanism', async () => {
    render(<AccessTokenCard isBot={false} />);

    expect(screen.getByText('AuthMechanism')).toBeInTheDocument();
  });

  it('should render AuthMechanism when isAuthMechanismEdit is false', async () => {
    await act(async () => {
      render(<AccessTokenCard isBot={false} />);
    });

    expect(await screen.findByText('AuthMechanism')).toBeInTheDocument();
  });

  it('should call onConfirm when Confirm button is clicked', async () => {
    const mockRevokeAccessToken = revokeAccessToken as jest.Mock;
    render(<AccessTokenCard isBot={false} />);
    const isModalClose = await screen.findByTestId('closed-confirmation-modal');

    expect(isModalClose).toBeInTheDocument();

    const openModalButton = await screen.findByTestId('open-modal-button');
    await act(async () => {
      fireEvent.click(openModalButton);
    });

    const confirmButton = await screen.findByTestId('confirm-button');
    fireEvent.click(confirmButton);

    expect(mockRevokeAccessToken).toHaveBeenCalled();
  });

  it('should call onCancel when Cancel button is clicked', async () => {
    await render(<AccessTokenCard isBot={false} />);
    const isModalClose = await screen.getByTestId('closed-confirmation-modal');

    expect(isModalClose).toBeInTheDocument();

    const openModalButton = await screen.getByTestId('open-modal-button');
    await act(async () => {
      fireEvent.click(openModalButton);
    });
    const cancelButton = await screen.getByTestId('cancel-button');
    fireEvent.click(cancelButton);
    const closedModal = await screen.getByTestId('closed-confirmation-modal');

    expect(closedModal).toBeInTheDocument();
  });
});
