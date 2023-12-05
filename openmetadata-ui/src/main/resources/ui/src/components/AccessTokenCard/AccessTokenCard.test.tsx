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
import { render } from '@testing-library/react';
import React from 'react';
import { getUserAccessToken } from '../../rest/userAPI';
import AccessTokenCard from './AccessTokenCard.component';

describe('AccessTokenCard Component', () => {
  // Mock data for authentication mechanism

  beforeEach(() => {
    jest.clearAllMocks();
  });

  jest.mock('axios');

  jest.mock('../../rest/userAPI', () => ({
    createUserAccessTokenWithPut: jest.fn().mockImplementation(() =>
      Promise.resolve({
        JWTTokenExpiry: 'tesst',
        tokenName: 'test',
      })
    ),
  }));
  jest.mock('../../rest/userAPI', () => ({
    getUserAccessToken: jest.fn().mockImplementation(() => Promise.resolve({})),
  }));

  it('renders initial state with AuthMechanismForm', async () => {
    const { getByText } = render(<AccessTokenCard isBot={false} />);

    expect(getByText('label.auth-mechanism')).toBeInTheDocument();
  });

  it('edits authentication mechanism', async () => {
    const { getByText } = render(<AccessTokenCard isBot={false} />);

    expect(getUserAccessToken).toHaveBeenCalled();

    expect(getByText('Personal Access Token')).toBeInTheDocument();
  });
});
