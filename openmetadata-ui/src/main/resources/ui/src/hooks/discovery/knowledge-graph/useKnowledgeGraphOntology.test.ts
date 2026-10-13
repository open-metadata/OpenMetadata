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
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, PropsWithChildren } from 'react';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { getGlossaryTermsByIds } from '../../../rest/glossaryAPI';
import { useKnowledgeGraphConceptDetails } from './useKnowledgeGraphOntology';

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTermsByIds: jest.fn(),
}));
const fetchTerms = getGlossaryTermsByIds as jest.MockedFunction<
  typeof getGlossaryTermsByIds
>;
const node = (id: string) => ({ id, type: 'glossaryTerm', label: id });
const term = (id: string) =>
  ({ id, name: id, attributes: [] } as unknown as GlossaryTerm);

const withClient = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
    },
  });
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children);

  return { client, wrapper };
};

beforeEach(() => fetchTerms.mockReset());

it('collects metadata in batches and surfaces missing concepts as partial', async () => {
  fetchTerms.mockImplementation(async (ids) =>
    ids.filter((id) => id !== '200').map(term)
  );
  const { wrapper } = withClient();
  const { result } = renderHook(
    () =>
      useKnowledgeGraphConceptDetails(
        Array.from({ length: 201 }, (_, index) => node(String(index))),
        true,
        0
      ),
    { wrapper }
  );
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.terms).toHaveLength(200);
  expect(result.current.partial).toBe(true);
});

it('keeps property metadata during refresh and after a failed response', async () => {
  let reject!: (error: Error) => void;
  fetchTerms.mockResolvedValueOnce([term('customer')]).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      })
  );
  const { wrapper } = withClient();
  const { result, rerender } = renderHook(
    ({ refresh }) =>
      useKnowledgeGraphConceptDetails([node('customer')], true, refresh),
    { initialProps: { refresh: 0 }, wrapper }
  );
  await waitFor(() => expect(result.current.terms).toHaveLength(1));
  rerender({ refresh: 1 });

  expect(result.current.loading).toBe(true);
  expect(result.current.terms[0].id).toBe('customer');

  await act(async () => reject(new Error('Unavailable')));
  await waitFor(() =>
    expect(result.current.error).toEqual(new Error('Unavailable'))
  );

  expect(result.current.terms[0].id).toBe('customer');
});

it('cancels obsolete metadata requests without replacing the selected concept', async () => {
  let resolve!: (terms: GlossaryTerm[]) => void;
  let oldSignal: AbortSignal | undefined;
  fetchTerms
    .mockImplementationOnce((_ids, _params, signal) => {
      oldSignal = signal;

      return new Promise((done) => {
        resolve = done;
      });
    })
    .mockResolvedValueOnce([term('current')]);
  const { wrapper } = withClient();
  const { result, rerender } = renderHook(
    ({ id }) => useKnowledgeGraphConceptDetails([node(id)], true, 0),
    { initialProps: { id: 'old' }, wrapper }
  );
  rerender({ id: 'current' });
  await waitFor(() => expect(result.current.terms[0]?.id).toBe('current'));

  expect(oldSignal?.aborted).toBe(true);

  await act(async () => resolve([term('stale')]));

  expect(result.current.terms.map((value) => value.id)).toEqual(['current']);
});
