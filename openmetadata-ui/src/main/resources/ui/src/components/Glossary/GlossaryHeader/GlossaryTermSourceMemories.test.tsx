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
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ContextMemory } from '../../../generated/entity/context/contextMemory';
import { getContextMemoryById } from '../../../rest/contextMemoryAPI';
import GlossaryTermSourceMemories from './GlossaryTermSourceMemories';

jest.mock('../../../rest/contextMemoryAPI', () => ({
  getContextMemoryById: jest.fn(),
}));

const mockGetContextMemoryById = getContextMemoryById as jest.MockedFunction<
  typeof getContextMemoryById
>;

const renderSourceMemories = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GlossaryTermSourceMemories memoryIds={['memory-id']} />
      </MemoryRouter>
    </QueryClientProvider>
  );

  return queryClient;
};

describe('GlossaryTermSourceMemories', () => {
  it('links an accessible source memory to its Context Center view', async () => {
    mockGetContextMemoryById.mockResolvedValue({
      id: 'memory-id',
      name: 'monthlyRecurringRevenue',
      title: 'Monthly recurring revenue',
    } as ContextMemory);

    renderSourceMemories();

    expect(
      await screen.findByRole('link', { name: 'Monthly recurring revenue' })
    ).toHaveAttribute(
      'href',
      '/context-center/memories?memory=monthlyRecurringRevenue'
    );
  });

  it('does not expose a memory the viewer cannot fetch', async () => {
    mockGetContextMemoryById.mockRejectedValue(new Error('Forbidden'));

    const queryClient = renderSourceMemories();

    await waitFor(() =>
      expect(
        queryClient.getQueryState([
          'glossary-term-source-memories',
          ['memory-id'],
        ])?.status
      ).toBe('success')
    );

    expect(screen.queryByTestId('glossary-term-source-memories')).toBeNull();
  });
});
