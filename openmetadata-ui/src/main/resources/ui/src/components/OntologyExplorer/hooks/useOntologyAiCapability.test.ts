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

import { renderHook, waitFor } from '@testing-library/react';
import { ProjectionState } from '../../../generated/api/rdf/rdfStatus';
import { fetchRdfConfig } from '../../../rest/rdfAPI';
import { useOntologyAiCapability } from './useOntologyAiCapability';

jest.mock('../../../rest/rdfAPI', () => ({
  fetchRdfConfig: jest.fn(),
}));

const mockFetchRdfConfig = fetchRdfConfig as jest.MockedFunction<
  typeof fetchRdfConfig
>;

const status = (askCollateEnabled: boolean, enabled = true) => ({
  askCollateEnabled,
  baseUri: 'https://open-metadata.org/',
  enabled,
  inference: {
    availableLevels: ['none'],
    defaultLevel: 'none',
    enabled: false,
  },
  projectionState: ProjectionState.Ready,
  storageType: 'fuseki',
});

describe('useOntologyAiCapability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enables AI only when the authenticated RDF status exposes it', async () => {
    mockFetchRdfConfig.mockResolvedValue(status(true));

    const { result } = renderHook(() => useOntologyAiCapability());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isRdfEnabled).toBe(true);
  });

  it('reports the knowledge graph as disabled when the RDF store is off', async () => {
    mockFetchRdfConfig.mockResolvedValue(status(false, false));

    const { result } = renderHook(() => useOntologyAiCapability());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.isRdfEnabled).toBe(false);
  });

  it('fails closed when status cannot be loaded', async () => {
    mockFetchRdfConfig.mockRejectedValue(new Error('unavailable'));

    const { result } = renderHook(() => useOntologyAiCapability());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.isRdfEnabled).toBe(false);
  });
});
