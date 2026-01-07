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

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DOMAINS_LIST } from '../../../mocks/Domains.mock';
import { getDomainByName } from '../../../rest/domainAPI';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import DomainDetailPage from './DomainDetailPage.component';

// Mock i18n to prevent 'add' method error
jest.mock('../../../utils/i18next/LocalUtil', () => ({
  __esModule: true,
  default: {
    t: (key: string) => key,
  },
  t: (key: string) => key,
  detectBrowserLanguage: () => 'en-US',
}));

// Mock react-helmet-async
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  HelmetProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

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
  useFqn: jest.fn(() => ({ fqn: 'test-domain' })),
}));

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

const mockGetDomainByName = getDomainByName as jest.MockedFunction<
  typeof getDomainByName
>;

describe('DomainDetailPage', () => {
  beforeEach(() => {
    mockGetDomainByName.mockResolvedValue(DOMAINS_LIST[0]);
  });

  it('should render domain detail page', async () => {
    const { container } = render(
      <MemoryRouter>
        <DomainDetailPage />
      </MemoryRouter>
    );

    // Check that the component renders without throwing
    expect(container).toBeInTheDocument();

    // The component should eventually fetch and display domain data
    expect(mockGetDomainByName).toHaveBeenCalledWith(
      'test-domain',
      expect.objectContaining({
        fields: expect.arrayContaining(['children', 'owners', 'parent']),
      })
    );
  });

  it('should handle missing FQN gracefully', () => {
    // Override the mock for this specific test
    const useFqnModule = jest.requireMock('../../../hooks/useFqn');
    useFqnModule.useFqn.mockReturnValueOnce({ fqn: undefined });

    const { container } = render(
      <MemoryRouter>
        <DomainDetailPage />
      </MemoryRouter>
    );

    // Component should render even without FQN (it may redirect or show error)
    expect(container).toBeInTheDocument();
  });

  it('should pass entity name as pageTitle to PageLayoutV1', async () => {
    render(
      <MemoryRouter>
        <DomainDetailPage />
      </MemoryRouter>
    );

    // Wait for the domain to be fetched
    expect(mockGetDomainByName).toHaveBeenCalled();

    // Verify pageTitle is passed
    expect(PageLayoutV1).toHaveBeenCalledWith(
      expect.objectContaining({
        pageTitle: DOMAINS_LIST[0].name,
      }),
      expect.anything()
    );
  });
});
