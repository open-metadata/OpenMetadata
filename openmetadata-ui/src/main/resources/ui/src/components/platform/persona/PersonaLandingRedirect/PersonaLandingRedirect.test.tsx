/*
 *  Copyright 2026 Collate.
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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { Document } from '../../../../generated/entity/docStore/document';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getDocumentByFQN } from '../../../../rest/DocStoreAPI';
import { PersonaLandingRedirect } from './PersonaLandingRedirect';

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('../../../../rest/DocStoreAPI', () => ({
  getDocumentByFQN: jest.fn(),
}));

const mockCookieGetItem = jest.fn();

jest.mock('cookie-storage', () => ({
  CookieStorage: jest.fn().mockImplementation(() => ({
    getItem: (key: string) => mockCookieGetItem(key),
  })),
}));

jest.mock('../../../common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

const mockUseApplicationStore = useApplicationStore as unknown as jest.Mock;
const mockGetDocumentByFQN = getDocumentByFQN as jest.MockedFunction<
  typeof getDocumentByFQN
>;

const persona = {
  id: 'persona-1',
  fullyQualifiedName: 'analytics',
  type: 'persona',
};

const personaDocument = (defaultLandingPage?: string): Document => ({
  entityType: 'Page',
  fullyQualifiedName: 'persona.analytics',
  name: 'analytics',
  data: {
    personaPreferences: [
      { personaId: persona.id, personaName: 'analytics', defaultLandingPage },
    ],
  },
});

const CurrentPath = () => {
  const { pathname } = useLocation();

  return (
    <>
      <span data-testid="pathname">{pathname}</span>
      <Link to="/">logo</Link>
    </>
  );
};

const renderAt = (path: string) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }>
      <MemoryRouter initialEntries={[path]}>
        <PersonaLandingRedirect>
          <CurrentPath />
        </PersonaLandingRedirect>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('PersonaLandingRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCookieGetItem.mockReturnValue(null);
    mockUseApplicationStore.mockReturnValue({ selectedPersona: persona });
    mockGetDocumentByFQN.mockResolvedValue(personaDocument('/glossary'));
  });

  it("sends the app's first page, /, to the persona's landing page", async () => {
    renderAt('/');

    expect(await screen.findByTestId('pathname')).toHaveTextContent(
      '/glossary'
    );
  });

  it('keeps / when the persona lands on Home', async () => {
    mockGetDocumentByFQN.mockResolvedValue(personaDocument());

    renderAt('/');

    expect(await screen.findByTestId('pathname')).toHaveTextContent(/^\/$/);
  });

  it('leaves a deep link alone', async () => {
    renderAt('/explore');

    expect(screen.getByTestId('pathname')).toHaveTextContent('/explore');
    expect(mockGetDocumentByFQN).not.toHaveBeenCalled();
  });

  it('lets a deep link stored before sign-in win', async () => {
    mockCookieGetItem.mockReturnValue('/table/sample.db.orders');

    renderAt('/');

    expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/$/);
    expect(mockGetDocumentByFQN).not.toHaveBeenCalled();
  });

  it('does not redirect a later in-app visit to /', async () => {
    renderAt('/explore');

    fireEvent.click(screen.getByText('logo'));

    expect(await screen.findByTestId('pathname')).toHaveTextContent(/^\/$/);
    expect(mockGetDocumentByFQN).not.toHaveBeenCalled();
  });

  it('keeps / without fetching when no persona is selected', () => {
    mockUseApplicationStore.mockReturnValue({ selectedPersona: undefined });

    renderAt('/');

    expect(screen.getByTestId('pathname')).toHaveTextContent(/^\/$/);
    expect(mockGetDocumentByFQN).not.toHaveBeenCalled();
  });
});
