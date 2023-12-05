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
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TokenType } from '../../generated/auth/personalAccessToken';
import AccessTokenCard from './AccessTokenCard.component';
import { MockProps } from './AccessTokenCard.interfaces';
// Mocking the required props

const mockProps: MockProps = {
  authenticationMechanism: {
    expiryDate: 1234567890,
    jwtToken: 'mockJwtToken',
    token: 'mockToken',
    tokenName: 'mockTokenName',
    tokenType: TokenType.PersonalAccessToken,
    userId: 'mockUserId',
  },
  isUpdating: false,
  isAuthMechanismEdit: false,
  hasPermission: true,
  onEdit: jest.fn(),
  onTokenRevoke: jest.fn(),
  onCancel: jest.fn(),
  onSave: jest.fn(),
  isBot: true,
};
jest.mock('../BotDetails/AuthMechanism', () => {
  return jest.fn().mockReturnValue(<p>AuthMechanism Component</p>);
});
jest.mock('../BotDetails/AuthMechanismForm', () => {
  return jest.fn().mockReturnValue(<p>AuthMechanismForm Component</p>);
});

describe('<AccessTokenCard />', () => {
  it('renders AuthMechanismForm when authenticationMechanism is not provided', () => {
    render(<AccessTokenCard {...mockProps} />);

    expect(screen.getByText('AuthMechanism Component')).toBeInTheDocument();
  });

  it('renders AuthMechanismForm when isAuthMechanismEdit is true', () => {
    render(<AccessTokenCard {...mockProps} isAuthMechanismEdit />);

    expect(screen.getByText('AuthMechanismForm Component')).toBeInTheDocument();
  });

  it('renders AuthMechanism when authenticationMechanism is provided and isAuthMechanismEdit is false', () => {
    render(<AccessTokenCard {...mockProps} />);

    expect(screen.getByText('AuthMechanism Component')).toBeInTheDocument();
  });
});
