/*
 *  Copyright 2024 Collate.
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
import { render } from '@testing-library/react';
import React from 'react';
import localState from '../../../../utils/LocalStorageUtils';
import Loader from '../../../common/Loader/Loader';
import { ConfidentialCallback } from './ConfidentialCallback';

let mockSearch =
  '?id_token=sample_id_token&name=John&email=john.doe@example.com&scope=user';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn().mockImplementation(() => ({
    search: mockSearch,
  })),
}));

jest.mock('../../../../utils/LocalStorageUtils', () => ({
  getOidcToken: jest.fn().mockReturnValue('sample_id_token'),
  setOidcToken: jest.fn(),
}));

jest.mock('../../../common/Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>Loader</div>),
}));

const mockHandleSuccessfullogin = jest.fn();
const mockSetIsAuthenticated = jest.fn();
const mockHandleFailedLogin = jest.fn();

jest.mock('../../AuthProviders/AuthProvider', () => ({
  __esModule: true,
  useAuthContext: jest.fn().mockImplementation(() => ({
    setIsAuthenticated: mockSetIsAuthenticated,
    handleSuccessfulLogin: mockHandleSuccessfullogin,
    handleFailedLogin: mockHandleFailedLogin,
  })),
}));

describe('ConfidentialCallback', () => {
  it('should render user information', () => {
    render(<ConfidentialCallback />);

    expect(mockSetIsAuthenticated).toHaveBeenCalledWith(true);
    expect(localState.setOidcToken).toHaveBeenCalledWith('sample_id_token');
    expect(mockHandleSuccessfullogin).toHaveBeenCalledWith({
      id_token: 'sample_id_token',
      profile: {
        name: 'John',
        email: 'john.doe@example.com',
      },
      scope: 'user',
    });
  });

  it('should render loader', () => {
    render(<ConfidentialCallback />);

    expect(Loader).toHaveBeenCalled();
  });

  it('should handle failed login', () => {
    mockSearch = '';
    render(<ConfidentialCallback />);

    expect(mockHandleFailedLogin).toHaveBeenCalled();
  });
});
