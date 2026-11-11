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
import { Table } from '../../../generated/entity/data/table';
import { getContractByEntityId } from '../../../rest/contractAPI';
import { getListTestCaseIncidentStatus } from '../../../rest/incidentManagerAPI';
import { getIngestionPipelines } from '../../../rest/ingestionPipelineAPI';
import { getTestCaseExecutionSummary } from '../../../rest/testAPI';
import { useAssetHealth } from './useAssetHealth';

jest.mock('../../../rest/contractAPI', () => ({
  getContractByEntityId: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatus: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../rest/testAPI', () => ({
  getTestCaseExecutionSummary: jest.fn().mockResolvedValue({}),
}));

const TABLE = {
  id: 'table-id',
  name: 'dim_address',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
  testSuite: { id: 'test-suite-id', type: 'testSuite' },
  service: {
    id: 'service-id',
    type: 'databaseService',
    fullyQualifiedName: 'sample_data',
  },
} as Table;

const ASSET_HEALTH_APIS = [
  getContractByEntityId,
  getListTestCaseIncidentStatus,
  getIngestionPipelines,
  getTestCaseExecutionSummary,
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useAssetHealth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches every health signal for a real table', async () => {
    const { result } = renderHook(() => useAssetHealth(TABLE), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    ASSET_HEALTH_APIS.forEach((api) => expect(api).toHaveBeenCalled());
  });
});
