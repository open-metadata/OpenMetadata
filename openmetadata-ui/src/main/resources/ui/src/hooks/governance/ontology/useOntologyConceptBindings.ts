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
import {
  CancelledError,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useCallback, useSyncExternalStore } from 'react';
import {
  BindingRead,
  BindingSnapshot,
  BindingWriteOutcome,
  RemoveAsset,
  ReplaceAsset,
} from '../../../interface/governance/ontology/ontologyConceptBindings.types';
import {
  deleteOntologyConceptBinding,
  getOntologyConceptBindings,
  putOntologyConceptBinding,
} from '../../../rest/ontologyAPI';

const queryKey = (id?: string) => ['ontology-concept-bindings', id];
const mutationKey = (id?: string) => ['ontology-concept-bindings-write', id];

type BindingCommand =
  | { kind: 'replace'; request: ReplaceAsset }
  | { kind: 'remove'; request: RemoveAsset };

export const useOntologyConceptBindings = (conceptId?: string) => {
  const client = useQueryClient();
  const isWriting =
    useIsMutating({
      mutationKey: mutationKey(conceptId),
      exact: true,
    }) > 0;
  const subscribe = useCallback(
    (notify: () => void) =>
      client.getQueryCache().subscribe((event) => {
        if (
          event.query.queryKey[0] === queryKey(conceptId)[0] &&
          event.query.queryKey[1] === conceptId
        ) {
          notify();
        }
      }),
    [client, conceptId]
  );
  const getReadState = useCallback(
    () => client.getQueryState<BindingSnapshot>(queryKey(conceptId)),
    [client, conceptId]
  );
  const cacheState = useSyncExternalStore(subscribe, getReadState);
  const isInvalidated = Boolean(cacheState?.isInvalidated);
  const isBlocked = isWriting || isInvalidated;
  const hasWriter = (id?: string) =>
    client.isMutating({ mutationKey: mutationKey(id), exact: true }) > 0;
  const query = useQuery({
    queryKey: queryKey(conceptId),
    enabled: Boolean(conceptId) && !isBlocked,
    gcTime: 30_000,
    staleTime: 30_000,
    retry: false,
    queryFn: ({ signal }) => {
      if (!conceptId) {
        throw new Error('Missing ontology concept');
      }
      if (hasWriter(conceptId)) {
        // Cancel through QueryClient so a guarded mount/refetch also returns to idle.
        void client.cancelQueries({
          queryKey: queryKey(conceptId),
          exact: true,
        });

        throw new CancelledError({ revert: true });
      }

      return getOntologyConceptBindings(conceptId, signal);
    },
  });
  const mutation = useMutation({
    mutationKey: mutationKey(conceptId),
    retry: false,
    networkMode: 'always',
    gcTime: 30_000,
    mutationFn: async ({
      id,
      command,
    }: {
      id: string;
      command: BindingCommand;
    }): Promise<BindingWriteOutcome> => {
      const key = queryKey(id);
      const state = client.getQueryState<BindingSnapshot>(key);
      if (
        client.isMutating({ mutationKey: mutationKey(id), exact: true }) !==
          1 ||
        state?.status !== 'success' ||
        state.isInvalidated ||
        state.data?.revision !== command.request.expectedRevision
      ) {
        return { kind: 'not-ready' };
      }
      await client.cancelQueries({ queryKey: key, exact: true });
      await client.invalidateQueries({
        queryKey: key,
        exact: true,
        refetchType: 'none',
      });
      let outcome: 'confirmed' | 'conflict' | 'unconfirmed';
      try {
        if (command.kind === 'replace') {
          await putOntologyConceptBinding(id, command.request);
        } else {
          await deleteOntologyConceptBinding(id, command.request);
        }
        outcome = 'confirmed';
      } catch (error) {
        outcome =
          isAxiosError(error) && error.response?.status === 409
            ? 'conflict'
            : 'unconfirmed';
      }

      let read: BindingRead;
      try {
        const snapshot = await getOntologyConceptBindings(id);
        client.getQueryCache().build(client, { queryKey: key, gcTime: 30_000 });
        client.setQueryData(key, snapshot);
        read = { kind: 'ready', snapshot };
      } catch {
        read = { kind: 'unavailable' };
      }

      return outcome === 'confirmed'
        ? { kind: 'confirmed', read }
        : { kind: outcome };
    },
  });
  const write = (command: BindingCommand): Promise<BindingWriteOutcome> => {
    if (!conceptId || hasWriter(conceptId)) {
      return Promise.resolve({ kind: 'not-ready' });
    }
    const state = client.getQueryState<BindingSnapshot>(queryKey(conceptId));
    if (
      state?.status !== 'success' ||
      state.fetchStatus !== 'idle' ||
      state.isInvalidated
    ) {
      return Promise.resolve({ kind: 'not-ready' });
    }
    if (state.data?.revision !== command.request.expectedRevision) {
      return Promise.resolve({ kind: 'not-ready' });
    }

    // mutateAsync dispatches pending before its first await, reserving this concept.
    return mutation.mutateAsync({ id: conceptId, command });
  };
  const retryRead = async (): Promise<void> => {
    if (
      !conceptId ||
      hasWriter(conceptId) ||
      client.getQueryState(queryKey(conceptId))?.fetchStatus !== 'idle'
    ) {
      return;
    }
    await query.refetch({ throwOnError: true });
  };
  const isReading = query.isPending || cacheState?.fetchStatus !== 'idle';
  const editableSnapshot =
    query.isSuccess && !isReading && !isBlocked ? query.data : undefined;
  let readState: 'loading' | 'ready' | 'unavailable' = 'unavailable';
  if (isWriting || isReading) {
    readState = 'loading';
  } else if (editableSnapshot) {
    readState = 'ready';
  }

  return {
    data: query.data,
    editableSnapshot,
    readState,
    isWriting,
    isPending: query.isPending,
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
    isError: query.isError,
    replaceAsset: (request: ReplaceAsset) =>
      write({ kind: 'replace', request }),
    removeAsset: (request: RemoveAsset) => write({ kind: 'remove', request }),
    retryRead,
  };
};
