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
import { ContextMemoryStatus } from '../../../../generated/entity/context/contextMemory';
import { getListContextMemories } from '../../../../rest/contextMemoryAPI';
import { useContextCenterBadges } from './useContextCenterBadges';

jest.mock('../../../../rest/contextMemoryAPI', () => ({
  getListContextMemories: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 4 } }),
}));

jest.mock('../../../../rest/assetAPI', () => ({
  listContextFiles: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
}));

jest.mock('../../../../rest/knowledgeCenterAPI', () => ({
  getListKnowledgePages: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useContextCenterBadges', () => {
  it('counts the memories the Context Center lists by default', async () => {
    const { result } = renderHook(() => useContextCenterBadges(true), {
      wrapper,
    });

    await waitFor(() => expect(result.current.memories).toBe(4));

    expect(getListContextMemories).toHaveBeenCalledWith({
      limit: 0,
      statuses: [
        ContextMemoryStatus.Approved,
        ContextMemoryStatus.Unprocessed,
      ].join(','),
    });
  });
});
