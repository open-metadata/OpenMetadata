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
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { Document } from '../../generated/entity/docStore/document';
import { PageViewMode } from '../../generated/type/personaPreferences';
import { getDocumentByFQN } from '../../rest/DocStoreAPI';
import { useApplicationStore } from '../useApplicationStore';
import { usePersonaViewMode } from './usePersonaViewMode';

jest.mock('../useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('../../rest/DocStoreAPI', () => ({
  getDocumentByFQN: jest.fn(),
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

const personaDocument: Document = {
  entityType: 'Page',
  fullyQualifiedName: 'persona.analytics',
  name: 'analytics',
  data: {
    personaPreferences: [
      {
        personaId: persona.id,
        personaName: 'analytics',
        defaultViewModes: { domains: PageViewMode.Tree },
      },
    ],
  },
};

const renderViewModeHook = (page: 'domains' | 'dataProducts') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  return renderHook(() => usePersonaViewMode(page), { wrapper });
};

describe('usePersonaViewMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDocumentByFQN.mockResolvedValue(personaDocument);
  });

  it("returns the selected persona's saved view once its document loads", async () => {
    mockUseApplicationStore.mockReturnValue({ selectedPersona: persona });

    const { result } = renderViewModeHook('domains');

    await waitFor(() => expect(result.current).toBe(PageViewMode.Tree));

    expect(mockGetDocumentByFQN).toHaveBeenCalledWith('persona.analytics');
  });

  it('returns Table for a page the persona has no view saved for', async () => {
    mockUseApplicationStore.mockReturnValue({ selectedPersona: persona });

    const { result } = renderViewModeHook('dataProducts');

    await waitFor(() => expect(mockGetDocumentByFQN).toHaveBeenCalled());

    expect(result.current).toBe(PageViewMode.Table);
  });

  it('returns Table without fetching when no persona is selected', () => {
    mockUseApplicationStore.mockReturnValue({ selectedPersona: undefined });

    const { result } = renderViewModeHook('domains');

    expect(result.current).toBe(PageViewMode.Table);
    expect(mockGetDocumentByFQN).not.toHaveBeenCalled();
  });
});
