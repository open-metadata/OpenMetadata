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
import { mocked } from 'jest-mock';
import {
  OperationState,
  OperationType,
} from '../../../generated/api/data/createOntologyChangeSet';
import {
  OntologyChangeSetState,
  OperationStatus,
} from '../../../generated/entity/data/ontologyChangeSet';
import APIClient from '../../../rest/axiosClient';
import { useOntologyChangeSetApply } from './useOntologyChangeSetApply';

jest.mock('../../../rest/axiosClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
}));
jest.mock('../../../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));
const plan = {
  name: 'unique-import',
  displayName: 'Import',
  description: 'Import',
  ontology: 'Sales',
  baseWorkingRevision: 4,
  operations: [
    {
      id: 'op',
      operationType: OperationType.UpsertConcept,
      state: OperationState.Active,
    },
  ],
};
const draft = {
  ...plan,
  id: 'draft',
  ontology: { id: 'sales', type: 'ontology', fullyQualifiedName: 'Sales' },
  state: OntologyChangeSetState.Draft,
  undoCursor: plan.operations.length,
};
const lock = {
  sessionId: 'session',
  version: 2,
  resourceId: 'draft',
  resourceType: 'ontologyChangeSet',
};
const post = mocked<
  (...args: Parameters<typeof APIClient.post>) => Promise<{ data: unknown }>
>(APIClient.post);
const get = mocked<
  (...args: Parameters<typeof APIClient.get>) => Promise<{ data: unknown }>
>(APIClient.get);
const applyCalls = () =>
  post.mock.calls.filter(([url]) => url.endsWith('/apply'));
const createCalls = () =>
  post.mock.calls.filter(([url]) => url === '/ontologyChangeSets');

beforeAll(() => jest.useRealTimers());

afterAll(() => jest.useFakeTimers());

describe('native change-set application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    get.mockImplementation(async (url) => ({
      data: url === '/ontologyChangeSets' ? { data: [], paging: {} } : draft,
    }));
    post.mockImplementation(async (url) => {
      if (url.endsWith('/apply')) {
        return { data: { ...draft, state: OntologyChangeSetState.Applied } };
      }

      return { data: url.endsWith('/acquire') ? lock : draft };
    });
  });

  it('applies one frozen plan once despite synchronous repeated submission', async () => {
    const onApplied = jest.fn();
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: true, onApplied })
    );
    await act(async () => {
      void result.current.start(plan);
      void result.current.start(plan);
    });
    await waitFor(() => expect(result.current.status.kind).toBe('applied'));

    expect(createCalls()).toEqual([['/ontologyChangeSets', plan]]);
    expect(applyCalls()).toEqual([
      [
        '/ontologyChangeSets/draft/apply',
        { lease: { sessionId: 'session', version: 2 } },
      ],
    ]);
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it('recovers a lost create response on a later cursor page without creating another draft', async () => {
    post.mockRejectedValueOnce(new Error('response lost'));
    get.mockResolvedValueOnce({
      data: {
        data: [{ ...draft, name: 'unrelated' }],
        paging: { after: 'next' },
      },
    });
    get.mockResolvedValueOnce({ data: { data: [draft], paging: {} } });
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: true, onApplied: jest.fn() })
    );
    await act(async () => {
      await result.current.start(plan);
    });
    await waitFor(() => expect(result.current.status.kind).toBe('applied'));

    expect(createCalls()).toHaveLength(1);
    expect(get).toHaveBeenCalledWith('/ontologyChangeSets', {
      params: {
        fields: 'operations,applicationResult',
        limit: 100,
        after: 'next',
      },
    });
  });

  it('keeps the frozen identity when reconciliation fails and only retries creation after proven absence', async () => {
    post.mockRejectedValueOnce(new Error('response lost'));
    get.mockRejectedValueOnce(new Error('lookup unavailable'));
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: true, onApplied: jest.fn() })
    );
    await act(async () => {
      await result.current.start(plan);
    });

    expect(result.current.status.kind).toBe('blocked');
    expect(result.current.configurationLocked).toBe(true);

    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.status.kind).toBe('applied'));

    expect(createCalls()).toEqual([
      ['/ontologyChangeSets', plan],
      ['/ontologyChangeSets', plan],
    ]);
  });

  it('does not adopt a same-name draft for a different native owner or revision', async () => {
    post.mockRejectedValueOnce(new Error('conflict'));
    get.mockResolvedValue({
      data: { data: [{ ...draft, baseWorkingRevision: 5 }], paging: {} },
    });
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: true, onApplied: jest.fn() })
    );
    await act(async () => {
      await result.current.start(plan);
    });

    expect(result.current.status.kind).toBe('blocked');
    expect(applyCalls()).toHaveLength(0);
  });

  it('reconciles an applied draft after a lost apply response without applying twice', async () => {
    let applied = false;
    post.mockImplementation(async (url) => {
      if (url.endsWith('/apply')) {
        applied = true;

        throw new Error('response lost');
      }

      return { data: url.endsWith('/acquire') ? lock : draft };
    });
    get.mockImplementation(async () => ({
      data: {
        ...draft,
        state: applied ? OntologyChangeSetState.Applied : draft.state,
      },
    }));
    const onApplied = jest.fn();
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: true, onApplied })
    );
    await act(async () => {
      await result.current.start(plan);
    });
    await waitFor(() => expect(result.current.status.kind).toBe('applied'));
    await act(async () => {
      await result.current.retry();
    });

    expect(applyCalls()).toHaveLength(1);
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it('retains an operation failure and reacquires the lease for the same draft on retry', async () => {
    post.mockImplementation(async (url) => {
      if (url.endsWith('/apply')) {
        return {
          data: {
            ...draft,
            state: OntologyChangeSetState.ApplyFailed,
            applicationResult: {
              results: [
                { status: OperationStatus.Failed, message: 'IRI conflict' },
              ],
            },
          },
        };
      }

      return { data: url.endsWith('/acquire') ? lock : draft };
    });
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: true, onApplied: jest.fn() })
    );
    await act(async () => {
      await result.current.start(plan);
    });
    await waitFor(() =>
      expect(result.current.status).toEqual({
        kind: 'blocked',
        message: 'IRI conflict',
      })
    );
    post.mockImplementation(async (url) => ({
      data: url.endsWith('/apply')
        ? { ...draft, state: OntologyChangeSetState.Applied }
        : lock,
    }));
    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.status.kind).toBe('applied'));

    expect(createCalls()).toHaveLength(1);
    expect(
      post.mock.calls.filter(([url]) => url.endsWith('/acquire'))
    ).toHaveLength(2);
  });

  it('completes unchanged plans without drafts or writes', async () => {
    const onApplied = jest.fn();
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: true, onApplied })
    );
    await act(async () => {
      await result.current.start({ ...plan, operations: [] });
    });

    expect(result.current.status.kind).toBe('unchanged');
    expect(post).not.toHaveBeenCalled();
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('accepts a new plan after an unchanged import', async () => {
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: true, onApplied: jest.fn() })
    );
    await act(async () => {
      await result.current.start({ ...plan, name: 'empty', operations: [] });
    });

    expect(result.current.status.kind).toBe('unchanged');

    await act(async () => {
      await result.current.start(plan);
    });
    await waitFor(() => expect(result.current.status.kind).toBe('applied'));

    expect(createCalls()).toEqual([['/ontologyChangeSets', plan]]);
  });

  it('does not mutate when permission is absent', async () => {
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: false, onApplied: jest.fn() })
    );
    await act(async () => {
      await result.current.start(plan);
    });

    expect(result.current.status.kind).toBe('blocked');
    expect(post).not.toHaveBeenCalled();
  });

  it('blocks after lease contention and reacquires before retrying the retained draft', async () => {
    let contended = true;
    post.mockImplementation(async (url) => {
      if (url.endsWith('/acquire')) {
        if (contended) {
          throw new Error('lease held');
        }

        return { data: lock };
      }

      return {
        data: url.endsWith('/apply')
          ? { ...draft, state: OntologyChangeSetState.Applied }
          : draft,
      };
    });
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: true, onApplied: jest.fn() })
    );
    await act(async () => {
      await result.current.start(plan);
    });
    await waitFor(() =>
      expect(result.current.status).toEqual({
        kind: 'blocked',
        message: 'message.native-ontology-import-lease-unavailable',
      })
    );

    expect(applyCalls()).toHaveLength(0);

    contended = false;
    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.status.kind).toBe('applied'));

    expect(createCalls()).toHaveLength(1);
  });

  it('blocks application if permission is revoked while draft creation completes', async () => {
    let resolveCreate!: (value: { data: unknown }) => void;
    post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );
    const { result, rerender } = renderHook(
      ({ canApply }) =>
        useOntologyChangeSetApply({ canApply, onApplied: jest.fn() }),
      { initialProps: { canApply: true } }
    );
    act(() => {
      void result.current.start(plan);
    });
    rerender({ canApply: false });
    await act(async () => {
      resolveCreate({ data: draft });
    });

    expect(result.current.status).toEqual({
      kind: 'blocked',
      message: 'message.no-permission-for-action',
    });
    expect(applyCalls()).toHaveLength(0);
  });

  it('does not treat a repeated cursor as proof that an uncertain draft is absent', async () => {
    post.mockRejectedValueOnce(new Error('response lost'));
    get.mockResolvedValue({
      data: {
        data: [{ ...draft, name: 'another' }],
        paging: { after: 'same' },
      },
    });
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: true, onApplied: jest.fn() })
    );
    await act(async () => {
      await result.current.start(plan);
    });

    expect(result.current.status.kind).toBe('blocked');

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.status.kind).toBe('blocked');
    expect(createCalls()).toHaveLength(1);
    expect(applyCalls()).toHaveLength(0);
  });

  it.each<{ field: string; changes: Partial<typeof draft> }>([
    { field: 'name', changes: { name: 'renamed' } },
    {
      field: 'owner',
      changes: { ontology: { ...draft.ontology, fullyQualifiedName: 'Other' } },
    },
    { field: 'revision', changes: { baseWorkingRevision: 5 } },
    {
      field: 'operations',
      changes: { operations: [{ ...plan.operations[0], id: 'changed' }] },
    },
    { field: 'cursor', changes: { undoCursor: 0 } },
  ])(
    'blocks retry when the retained draft $field changed',
    async ({ changes }) => {
      post.mockImplementation(async (url) => ({
        data: url.endsWith('/acquire')
          ? lock
          : {
              ...draft,
              state: url.endsWith('/apply')
                ? OntologyChangeSetState.ApplyFailed
                : draft.state,
            },
      }));
      const onApplied = jest.fn();
      const { result } = renderHook(() =>
        useOntologyChangeSetApply({ canApply: true, onApplied })
      );
      await act(async () => {
        await result.current.start(plan);
      });
      await waitFor(() => expect(result.current.status.kind).toBe('blocked'));
      get.mockResolvedValue({ data: { ...draft, ...changes } });
      await act(async () => {
        await result.current.retry();
      });
      await waitFor(() => expect(result.current.status.kind).toBe('blocked'));

      expect(applyCalls()).toHaveLength(1);
      expect(createCalls()).toHaveLength(1);
      expect(onApplied).not.toHaveBeenCalled();
    }
  );

  it('blocks a draft changed between the retry read and lease acquisition', async () => {
    let acquireCount = 0;
    post.mockImplementation(async (url) => {
      if (url.endsWith('/acquire')) {
        acquireCount++;
        if (acquireCount === 2) {
          get.mockResolvedValue({
            data: {
              ...draft,
              operations: [{ ...plan.operations[0], id: 'changed' }],
            },
          });
        }

        return { data: lock };
      }

      return {
        data: {
          ...draft,
          state: url.endsWith('/apply')
            ? OntologyChangeSetState.ApplyFailed
            : draft.state,
        },
      };
    });
    const onApplied = jest.fn();
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: true, onApplied })
    );
    await act(async () => {
      await result.current.start(plan);
    });
    await waitFor(() => expect(result.current.status.kind).toBe('blocked'));
    await act(async () => {
      await result.current.retry();
    });
    await waitFor(() => expect(result.current.status.kind).toBe('blocked'));

    expect(acquireCount).toBe(2);
    expect(applyCalls()).toHaveLength(1);
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('does not complete the import from a changed APPLIED response after response loss', async () => {
    post.mockImplementation(async (url) => {
      if (url.endsWith('/apply')) {
        get.mockResolvedValue({
          data: {
            ...draft,
            state: OntologyChangeSetState.Applied,
            operations: [{ ...plan.operations[0], id: 'changed' }],
          },
        });

        throw new Error('response lost');
      }

      return { data: url.endsWith('/acquire') ? lock : draft };
    });
    const onApplied = jest.fn();
    const { result } = renderHook(() =>
      useOntologyChangeSetApply({ canApply: true, onApplied })
    );
    await act(async () => {
      await result.current.start(plan);
    });
    await waitFor(() => expect(result.current.status.kind).toBe('blocked'));

    expect(applyCalls()).toHaveLength(1);
    expect(onApplied).not.toHaveBeenCalled();
  });
});
