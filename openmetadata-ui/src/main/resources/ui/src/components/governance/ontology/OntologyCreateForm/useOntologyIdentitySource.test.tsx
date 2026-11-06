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
import { ReactNode } from 'react';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { listOntologies } from '../../../../rest/ontologyAPI';
import { fetchRdfConfig } from '../../../../rest/rdfAPI';
import { useOntologyIdentitySource } from './useOntologyIdentitySource';

jest.mock('../../../../rest/ontologyAPI', () => ({
  listOntologies: jest.fn(),
}));
jest.mock('../../../../rest/rdfAPI', () => ({ fetchRdfConfig: jest.fn() }));

const softDeleted = {
  id: 'old',
  name: 'shop-csv',
  displayName: 'Shop CSV',
  namespace: 'https://open-metadata.org/onto/shopcsv#',
} as Ontology;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useOntologyIdentitySource', () => {
  beforeEach(() => {
    (fetchRdfConfig as jest.Mock).mockResolvedValue({
      baseUri: 'https://open-metadata.org',
    });
    (listOntologies as jest.Mock).mockImplementation(async (params) => ({
      data: params?.include === 'all' ? [softDeleted] : [],
      paging: { total: 1 },
    }));
  });

  it('gives a free name when a soft-deleted ontology still holds the title', async () => {
    const { result } = renderHook(() => useOntologyIdentitySource(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.identityOf('Shop CSV')).toMatchObject({
      name: 'shop-csv-2',
      displayName: 'Shop CSV (2)',
    });
  });

  it('reads the names again at import time and sees one taken since the panel opened', async () => {
    const { result } = renderHook(() => useOntologyIdentitySource(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    (listOntologies as jest.Mock).mockImplementation(async () => ({
      data: [
        softDeleted,
        {
          ...softDeleted,
          name: 'shop-csv-2',
          displayName: 'Shop CSV (2)',
          namespace: 'https://open-metadata.org/onto/shopcsv2#',
        },
      ],
      paging: { total: 2 },
    }));
    const identityOf = await result.current.refreshIdentityOf();

    expect(identityOf('Shop CSV')?.displayName).toBe('Shop CSV (3)');
  });
});
