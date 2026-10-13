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

import { act, renderHook, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import {
  getSavedSparqlQueries,
  getSparqlQueryTemplates,
  replaceSavedSparqlQueries,
  replaceSparqlQueryTemplates,
  SavedSparqlQuery,
} from '../rest/rdfAPI';
import { showErrorToast } from '../utils/ToastUtils';
import { useSparqlQueryLibrary } from './useSparqlQueryLibrary';

jest.mock('../rest/rdfAPI', () => ({
  getSavedSparqlQueries: jest.fn(),
  getSparqlQueryTemplates: jest.fn(),
  replaceSavedSparqlQueries: jest.fn(),
  replaceSparqlQueryTemplates: jest.fn(),
}));

jest.mock('../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const LEGACY_KEY = 'om.sparql-playground.savedQueries';

const mockGetSaved = getSavedSparqlQueries as jest.MockedFunction<
  typeof getSavedSparqlQueries
>;
const mockGetTemplates = getSparqlQueryTemplates as jest.MockedFunction<
  typeof getSparqlQueryTemplates
>;
const mockReplaceSaved = replaceSavedSparqlQueries as jest.MockedFunction<
  typeof replaceSavedSparqlQueries
>;
const mockReplaceTemplates = replaceSparqlQueryTemplates as jest.MockedFunction<
  typeof replaceSparqlQueryTemplates
>;

const buildQuery = (id: string, name = id): SavedSparqlQuery => ({
  id,
  name,
  query: `SELECT ?s WHERE { ?s ?p "${id}" }`,
  format: 'json',
  inference: 'none',
  savedAt: 1,
});

const SERVER_QUERY = buildQuery('server-1');
const LEGACY_QUERY = buildQuery('legacy-1');
const TEMPLATE = buildQuery('template-1');

const renderLibrary = async () => {
  const hook = renderHook(() => useSparqlQueryLibrary());
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));

  return hook;
};

describe('useSparqlQueryLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    mockGetSaved.mockResolvedValue([SERVER_QUERY]);
    mockGetTemplates.mockResolvedValue([TEMPLATE]);
    mockReplaceSaved.mockImplementation(async (queries) => queries);
    mockReplaceTemplates.mockImplementation(async (queries) => queries);
  });

  it('loads saved queries and templates from the server', async () => {
    const { result } = await renderLibrary();

    expect(result.current.savedQueries).toEqual([SERVER_QUERY]);
    expect(result.current.queryTemplates).toEqual([TEMPLATE]);
    expect(mockReplaceSaved).not.toHaveBeenCalled();
  });

  it('merges valid legacy queries, persists them and clears the legacy cache', async () => {
    window.localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify([
        LEGACY_QUERY,
        { ...SERVER_QUERY, name: 'stale duplicate' },
        { id: 'missing-fields' },
        { ...buildQuery('bad-format'), format: 'yaml' },
        { ...buildQuery('bad-inference'), inference: 'deep' },
        { ...buildQuery('bad-saved-at'), savedAt: 'yesterday' },
        null,
      ])
    );

    const { result } = await renderLibrary();

    expect(mockReplaceSaved).toHaveBeenCalledWith([SERVER_QUERY, LEGACY_QUERY]);
    expect(result.current.savedQueries).toEqual([SERVER_QUERY, LEGACY_QUERY]);
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('ignores a legacy cache that is not an array', async () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ id: 'x' }));

    const { result } = await renderLibrary();

    expect(mockReplaceSaved).not.toHaveBeenCalled();
    expect(result.current.savedQueries).toEqual([SERVER_QUERY]);
  });

  it('ignores a legacy cache that is not valid JSON', async () => {
    window.localStorage.setItem(LEGACY_KEY, '{not json');

    const { result } = await renderLibrary();

    expect(mockReplaceSaved).not.toHaveBeenCalled();
    expect(result.current.savedQueries).toEqual([SERVER_QUERY]);
  });

  it('keeps the legacy cache when the merge persistence fails with an axios error', async () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify([LEGACY_QUERY]));
    const error = new AxiosError('boom');
    mockReplaceSaved.mockRejectedValue(error);

    const { result } = await renderLibrary();

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(result.current.savedQueries).toEqual([]);
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });

  it('shows the generic error message when loading fails with a non-axios error', async () => {
    mockGetTemplates.mockRejectedValue(new Error('offline'));

    await renderLibrary();

    expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error');
  });

  it('skips state updates when unmounted before the load settles', async () => {
    let resolveSaved!: (queries: SavedSparqlQuery[]) => void;
    mockGetSaved.mockReturnValue(
      new Promise<SavedSparqlQuery[]>((resolve) => {
        resolveSaved = resolve;
      })
    );

    const { result, unmount } = renderHook(() => useSparqlQueryLibrary());
    unmount();
    await act(async () => {
      resolveSaved([SERVER_QUERY]);
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.savedQueries).toEqual([]);
  });

  it('upserts a saved query by replacing the entry with the same id', async () => {
    const { result } = await renderLibrary();
    const updated = { ...SERVER_QUERY, name: 'renamed' };

    let saved = false;
    await act(async () => {
      saved = await result.current.upsertSavedQuery(updated);
    });

    expect(saved).toBe(true);
    expect(mockReplaceSaved).toHaveBeenCalledWith([updated]);
    expect(result.current.savedQueries).toEqual([updated]);
  });

  it('reports failure and toasts when upserting a saved query fails', async () => {
    const { result } = await renderLibrary();
    const error = new AxiosError('denied');
    mockReplaceSaved.mockRejectedValue(error);

    let saved = true;
    await act(async () => {
      saved = await result.current.upsertSavedQuery(buildQuery('new'));
    });

    expect(saved).toBe(false);
    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(result.current.savedQueries).toEqual([SERVER_QUERY]);
  });

  it('deletes a saved query by id', async () => {
    const { result } = await renderLibrary();

    let deleted = false;
    await act(async () => {
      deleted = await result.current.deleteSavedQuery(SERVER_QUERY.id);
    });

    expect(deleted).toBe(true);
    expect(mockReplaceSaved).toHaveBeenCalledWith([]);
    expect(result.current.savedQueries).toEqual([]);
  });

  it('reports failure when deleting a saved query fails', async () => {
    const { result } = await renderLibrary();
    mockReplaceSaved.mockRejectedValue(new Error('offline'));

    let deleted = true;
    await act(async () => {
      deleted = await result.current.deleteSavedQuery(SERVER_QUERY.id);
    });

    expect(deleted).toBe(false);
    expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error');
  });

  it('upserts a query template', async () => {
    const { result } = await renderLibrary();
    const next = buildQuery('template-2');

    let saved = false;
    await act(async () => {
      saved = await result.current.upsertQueryTemplate(next);
    });

    expect(saved).toBe(true);
    expect(mockReplaceTemplates).toHaveBeenCalledWith([TEMPLATE, next]);
    expect(result.current.queryTemplates).toEqual([TEMPLATE, next]);
  });

  it('reports failure when upserting a query template fails', async () => {
    const { result } = await renderLibrary();
    mockReplaceTemplates.mockRejectedValue(new Error('offline'));

    let saved = true;
    await act(async () => {
      saved = await result.current.upsertQueryTemplate(buildQuery('t'));
    });

    expect(saved).toBe(false);
    expect(showErrorToast).toHaveBeenCalledWith('server.unexpected-error');
  });

  it('deletes a query template by id', async () => {
    const { result } = await renderLibrary();

    let deleted = false;
    await act(async () => {
      deleted = await result.current.deleteQueryTemplate(TEMPLATE.id);
    });

    expect(deleted).toBe(true);
    expect(mockReplaceTemplates).toHaveBeenCalledWith([]);
    expect(result.current.queryTemplates).toEqual([]);
  });

  it('reports failure when deleting a query template fails', async () => {
    const { result } = await renderLibrary();
    const error = new AxiosError('denied');
    mockReplaceTemplates.mockRejectedValue(error);

    let deleted = true;
    await act(async () => {
      deleted = await result.current.deleteQueryTemplate(TEMPLATE.id);
    });

    expect(deleted).toBe(false);
    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(result.current.queryTemplates).toEqual([TEMPLATE]);
  });
});
