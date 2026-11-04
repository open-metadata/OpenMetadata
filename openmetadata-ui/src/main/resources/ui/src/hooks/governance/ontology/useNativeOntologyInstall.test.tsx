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
  CreateOntologyChangeSet,
  OperationState,
  OperationType,
} from '../../../generated/api/data/createOntologyChangeSet';
import { OntologyChangeSetState } from '../../../generated/entity/data/ontologyChangeSet';
import {
  applyOntologyChangeSet,
  createOntology,
  createOntologyChangeSet,
  getOntologyByName,
  getOntologyChangeSet,
} from '../../../rest/ontologyAPI';
import { useNativeOntologyInstall } from './useNativeOntologyInstall';

jest.mock('../../../rest/ontologyAPI', () => ({
  applyOntologyChangeSet: jest.fn(),
  createOntology: jest.fn(),
  createOntologyChangeSet: jest.fn(),
  getOntologyByName: jest.fn(),
  getOntologyChangeSet: jest.fn(),
  listOntologyChangeSets: jest.fn(),
}));
jest.mock('../../../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));
jest.mock('../../useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: () => ({
    canEditAll: true,
    isLoading: false,
    error: null,
  }),
}));
jest.mock('./useOntologyEditLease', () => ({
  useOntologyEditLease: ({ resourceId }: { resourceId?: string }) => ({
    isOwned: Boolean(resourceId),
    lock: resourceId ? { sessionId: 'session-id', version: 2 } : undefined,
    state: 'owned',
  }),
}));

const { resolveNativeLibraryTarget } = jest.requireActual(
  '../../../components/governance/ontology/OntologyNativeLibraryDetail/OntologyNativeLibraryDetail.utils'
);
const request = {
  name: 'shop-3f2a',
  displayName: 'Shop',
  iri: 'urn:openmetadata:ontology:3f2a',
  namespace: 'urn:openmetadata:ontology:3f2a:',
};
const created = {
  id: 'ontology-id',
  name: request.name,
  iri: request.iri,
  namespace: request.namespace,
  fullyQualifiedName: request.name,
};
const changeSet: CreateOntologyChangeSet = {
  name: 'import-1',
  displayName: 'Import',
  description: 'Import',
  ontology: request.name,
  baseWorkingRevision: 1,
  operations: [
    {
      id: 'operation-id',
      operationType: OperationType.UpsertConcept,
      state: OperationState.Active,
    },
  ],
};
const draft = {
  ...changeSet,
  id: 'draft-id',
  ontology: {
    id: created.id,
    type: 'ontology',
    fullyQualifiedName: request.name,
  },
  state: OntologyChangeSetState.Draft,
  undoCursor: 1,
};
const lostResponse = new AxiosError('Network Error');

const renderInstall = (plan = jest.fn().mockResolvedValue(changeSet)) => {
  const onInstalled = jest.fn();
  const view = renderHook(() =>
    useNativeOntologyInstall({
      canCreate: true,
      resolveNew: resolveNativeLibraryTarget,
      plan,
      onInstalled,
    })
  );

  return { ...view, plan, onInstalled };
};

describe('useNativeOntologyInstall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createOntology as jest.Mock).mockResolvedValue(created);
    (createOntologyChangeSet as jest.Mock).mockResolvedValue(draft);
    (getOntologyChangeSet as jest.Mock).mockResolvedValue(draft);
    (applyOntologyChangeSet as jest.Mock).mockResolvedValue({
      ...draft,
      state: OntologyChangeSetState.Applied,
    });
  });

  it('creates the new ontology, plans against it, and applies under the lease', async () => {
    const { result, plan, onInstalled } = renderInstall();

    await act(async () => {
      await result.current.start({ kind: 'new', request });
    });

    await waitFor(() => expect(onInstalled).toHaveBeenCalledTimes(1));

    expect(createOntology).toHaveBeenCalledWith(request);
    expect(plan).toHaveBeenCalledWith(created);
    expect(applyOntologyChangeSet).toHaveBeenCalledWith('draft-id', {
      lease: { sessionId: 'session-id', version: 2 },
    });
    expect(onInstalled).toHaveBeenCalledWith(created, 'applied');
  });

  it('plans against an existing ontology without creating one', async () => {
    const { result, plan, onInstalled } = renderInstall();

    await act(async () => {
      await result.current.start({ kind: 'existing', ontology: created });
    });

    await waitFor(() => expect(onInstalled).toHaveBeenCalledTimes(1));

    expect(createOntology).not.toHaveBeenCalled();
    expect(plan).toHaveBeenCalledWith(created);
  });

  it('recovers the ontology a lost create response already made instead of creating a second', async () => {
    (createOntology as jest.Mock).mockRejectedValueOnce(lostResponse);
    (getOntologyByName as jest.Mock).mockResolvedValue(created);
    const { result, onInstalled } = renderInstall();

    await act(async () => {
      await result.current.start({ kind: 'new', request });
    });

    await waitFor(() =>
      expect(onInstalled).toHaveBeenCalledWith(created, 'applied')
    );

    expect(createOntology).toHaveBeenCalledTimes(1);
    expect(getOntologyByName).toHaveBeenCalledWith(request.name);
  });

  it('retries a failed plan against the same ontology with the same create request', async () => {
    const plan = jest
      .fn()
      .mockRejectedValueOnce(new Error('preview failed'))
      .mockResolvedValue(changeSet);
    const { result, onInstalled } = renderInstall(plan);

    await act(async () => {
      await result.current.start({ kind: 'new', request });
    });
    await waitFor(() =>
      expect(result.current.error).toBe('server.unexpected-error')
    );

    expect(result.current.isLocked).toBe(true);

    await act(async () => {
      await result.current.start({
        kind: 'new',
        request: { ...request, name: 'a-different-name' },
      });
    });
    await waitFor(() => expect(onInstalled).toHaveBeenCalledTimes(1));

    expect(createOntology).toHaveBeenCalledTimes(1);
    expect(createOntology).toHaveBeenCalledWith(request);
    expect(plan).toHaveBeenCalledTimes(2);
  });

  it('does not create an ontology when the user cannot create one', async () => {
    const onInstalled = jest.fn();
    const { result } = renderHook(() =>
      useNativeOntologyInstall({
        canCreate: false,
        resolveNew: resolveNativeLibraryTarget,
        plan: jest.fn(),
        onInstalled,
      })
    );

    await act(async () => {
      await result.current.start({ kind: 'new', request });
    });

    expect(createOntology).not.toHaveBeenCalled();
    expect(onInstalled).not.toHaveBeenCalled();
    expect(result.current.error).toBe('server.unexpected-error');
  });
});
