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

import { findByText, render } from '@testing-library/react';
import React from 'react';
import AddGlossaryPage from './AddGlossaryPage.component';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
}));

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

jest.mock('../../components/AddGlossary/AddGlossary.component', () => {
  return jest.fn().mockReturnValue(<div>AddGlossary.component</div>);
});

jest.mock('../../axiosAPIs/glossaryAPI', () => ({
  addGlossaries: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test AddGlossary component page', () => {
  it('AddGlossary component page should render', async () => {
    const { container } = render(<AddGlossaryPage />);

    const addGlossary = await findByText(container, /AddGlossary.component/i);

    expect(addGlossary).toBeInTheDocument();
  });
});
