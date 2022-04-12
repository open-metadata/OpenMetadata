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
import GlossaryPageV1 from './GlossaryPageV1.component';

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockReturnValue({
    glossaryName: 'GlossaryName',
  }),
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

jest.mock('../../components/Glossary/GlossaryV1.component', () => {
  return jest.fn().mockReturnValue(<div>Glossary.component</div>);
});

jest.mock('../../axiosAPIs/glossaryAPI', () => ({
  getGlossaries: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test GlossaryComponent page', () => {
  it('GlossaryComponent Page Should render', async () => {
    const { container } = render(<GlossaryPageV1 />);

    const glossaryComponent = await findByText(
      container,
      /Glossary.component/i
    );

    expect(glossaryComponent).toBeInTheDocument();
  });
});
