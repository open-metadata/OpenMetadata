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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MOCK_DOMAINS } from '../../../mocks/Domains.mock';
import { getDomainByName } from '../../../rest/domainAPI';
import DomainDetailPage from './DomainDetailPage.component';

jest.mock('../../../rest/domainAPI');
jest.mock('../../../hooks/useDomainStore', () => ({
  useDomainStore: () => ({
    updateDomains: jest.fn(),
  }),
}));
jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { id: '1' },
  }),
}));
jest.mock('../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'test-domain' }),
}));

const mockGetDomainByName = getDomainByName as jest.MockedFunction<
  typeof getDomainByName
>;

describe('DomainDetailPage', () => {
  beforeEach(() => {
    mockGetDomainByName.mockResolvedValue(MOCK_DOMAINS[0]);
  });

  it('should render domain detail page', async () => {
    render(
      <MemoryRouter>
        <DomainDetailPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should redirect to domains list if no FQN provided', () => {
    const mockNavigate = jest.fn();
    jest.doMock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
    }));

    jest.doMock('../../../hooks/useFqn', () => ({
      useFqn: () => ({ fqn: undefined }),
    }));

    render(
      <MemoryRouter>
        <DomainDetailPage />
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/domain');
  });
});
