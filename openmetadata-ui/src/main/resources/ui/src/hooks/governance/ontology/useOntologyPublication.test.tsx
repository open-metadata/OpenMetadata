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
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { VersionBump } from '../../../generated/api/data/captureOntologyRelease';
import {
  Ontology,
  OntologyApprovalRule,
} from '../../../generated/entity/data/ontology';
import {
  EncodingVersion,
  EntityStatus,
  LogicalCheck,
  OntologyRelease,
} from '../../../generated/entity/data/ontologyRelease';
import { Stage } from '../../../generated/type/ontologyPublicationStatus';
import { OntologyState } from '../../../generated/type/ontologyState';
import APIClient from '../../../rest/axiosClient';
import { runQueryNotificationsSynchronously } from '../../../test/unit/test-utils';
import { useApplicationStore } from '../../useApplicationStore';
import { useOntologyPublication } from './useOntologyPublication';

jest.mock('../../../rest/axiosClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
}));
jest.mock('../../../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));

const get = APIClient.get as jest.MockedFunction<typeof APIClient.get>;
const post = APIClient.post as jest.MockedFunction<typeof APIClient.post>;
const owner = '00000000-0000-4000-8000-000000000001';
const editor = '00000000-0000-4000-8000-000000000002';
const reviewer = '00000000-0000-4000-8000-000000000003';
const releaseId = (revision: number) =>
  `00000000-0000-4000-8000-${String(revision).padStart(12, '0')}`;
const makeRelease = (revision: number): OntologyRelease => ({
  id: releaseId(revision),
  ontology: { id: owner, type: 'ontology' },
  name: `release-${revision}`,
  fullyQualifiedName: `Sales.release-${revision}`,
  releaseRevision: revision,
  semanticVersion: `1.${revision}.0`,
  sourceWorkingRevision: 7,
  sealedAt: 1,
  sealedBy: 'author',
  reviewAuthor: 'author',
  memberCount: 1,
  totalBytes: 100,
  ontologyIri: 'urn:sales',
  versionIri: `urn:sales:${revision}`,
  contentDigest: 'a'.repeat(64),
  baseReleaseId: releaseId(1),
  encodingVersion: EncodingVersion.OntologyReleaseV1,
  logicalCheck: LogicalCheck.NotRun,
  entityStatus: EntityStatus.Draft,
});
let currentState: OntologyState;
let ontology: Ontology;
let releases: OntologyRelease[];

const setup = async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  let hook:
    | ReturnType<
        typeof renderHook<
          ReturnType<typeof useOntologyPublication>,
          { ontologyId: string }
        >
      >
    | undefined;
  await act(async () => {
    hook = renderHook(
      ({ ontologyId }) => useOntologyPublication(ontologyId, true, true),
      { wrapper, initialProps: { ontologyId: owner } }
    );
  });
  if (!hook) {
    throw new Error('Hook did not render');
  }

  return hook;
};

runQueryNotificationsSynchronously();

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  sessionStorage.clear();
  useApplicationStore.setState({
    currentUser: { id: editor, name: 'editor', email: 'editor@example.com' },
  });
  releases = [
    makeRelease(5),
    { ...makeRelease(1), entityStatus: EntityStatus.Approved },
  ];
  currentState = {
    ontologyId: owner,
    workingRevision: 7,
    activationRevision: 3,
    lastReleaseRevision: 5,
    activeReleaseId: releaseId(1),
  };
  ontology = {
    id: owner,
    name: 'Sales',
    fullyQualifiedName: 'Sales',
    iri: 'urn:sales',
    namespace: 'urn:sales:',
    version: 0.1,
    reviewers: [{ id: reviewer, type: 'user', name: 'reviewer' }],
    approvalRule: OntologyApprovalRule.AnyReviewer,
    publicationStatus: {
      latest: {
        releaseId: releaseId(5),
        releaseRevision: 5,
        semanticVersion: '1.5.0',
        stage: Stage.Draft,
      },
      active: { releaseId: releaseId(1), releaseRevision: 1 },
      reviewLock: {},
      unpublishedChanges: 1,
    },
  };
  get.mockImplementation(async (url) => {
    if (url === `/ontologies/${owner}`) {
      return { data: ontology };
    }
    if (url === `/ontologies/${owner}/state`) {
      return { data: currentState };
    }
    if (url === `/ontologies/${owner}/working/diff`) {
      return { data: { state: currentState, data: [], paging: { total: 1 } } };
    }
    if (url === `/ontologies/${owner}/releases`) {
      return { data: { data: releases, paging: { total: releases.length } } };
    }
    const release = releases.find(
      (entry) => url === `/ontologyReleases/${entry.id}`
    );
    if (release) {
      return { data: release };
    }

    throw new Error(`Unexpected read ${url}`);
  });
});

afterEach(() => {
  jest.useFakeTimers();
});

it('opens the latest Draft when active is older, and keeps current separate from history selection', async () => {
  const hook = await setup();

  expect(hook.result.current.release?.id).toBe(releaseId(5));

  act(() => hook.result.current.setSelectedId(releaseId(1)));
  await waitFor(() =>
    expect(hook.result.current.release?.id).toBe(releaseId(1))
  );

  expect(hook.result.current.current.kind).toBe('ready');

  if (hook.result.current.current.kind !== 'ready') {
    throw new Error('Current unavailable');
  }

  expect(hook.result.current.current.value.candidate?.id).toBe(releaseId(5));
});

it('does not create a second task after an unknown task outcome returns Draft without a task', async () => {
  const hook = await setup();

  expect(hook.result.current.latestVersioned.isSuccess).toBe(true);

  post.mockImplementation(async (url) => {
    if (url === `/ontologies/${owner}/releases`) {
      const captured = makeRelease(currentState.lastReleaseRevision + 1);
      releases.unshift(captured);
      currentState = {
        ...currentState,
        lastReleaseRevision: captured.releaseRevision,
      };
      ontology = {
        ...ontology,
        publicationStatus: {
          ...ontology.publicationStatus,
          unpublishedChanges: 1,
          latest: {
            releaseId: captured.id,
            releaseRevision: captured.releaseRevision,
            semanticVersion: captured.semanticVersion,
            stage: Stage.Draft,
          },
        },
      };

      return { data: captured };
    }
    if (url === '/tasks') {
      throw new Error('Response lost after T1 was created and cancelled');
    }

    throw new Error(`Unexpected write ${url}`);
  });
  await act(async () => {
    await hook.result.current.captureAndRequestApproval(currentState, {
      versionBump: VersionBump.Minor,
    });
  });

  expect(post).toHaveBeenCalledWith(
    '/tasks',
    expect.objectContaining({ type: 'RequestApproval' })
  );

  hook.unmount();
  const reopened = await setup();
  await waitFor(() =>
    expect(reopened.result.current.latestVersioned.isSuccess).toBe(true)
  );
  await act(async () => {
    await reopened.result.current.captureAndRequestApproval(currentState, {
      versionBump: VersionBump.Minor,
    });
  });

  expect(post.mock.calls.filter(([url]) => url === '/tasks')).toHaveLength(1);

  await act(async () => {
    await reopened.result.current.retryRecovery();
  });

  expect(reopened.result.current.recovery).not.toBeNull();
  expect(post.mock.calls.filter(([url]) => url === '/tasks')).toHaveLength(1);
});

it('recovers a known r5 task rejection after reload without moving the r6 footer or capturing again', async () => {
  const hook = await setup();
  post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 400 } });
  await act(async () => {
    await hook.result.current.captureAndRequestApproval(currentState, {
      versionBump: VersionBump.Minor,
    });
  });

  expect(hook.result.current.recovery?.operation).toBe('review');

  releases.unshift(makeRelease(6));
  currentState = { ...currentState, lastReleaseRevision: 6 };
  ontology = {
    ...ontology,
    publicationStatus: {
      ...ontology.publicationStatus,
      unpublishedChanges: 1,
      latest: {
        releaseId: releaseId(6),
        releaseRevision: 6,
        semanticVersion: '1.6.0',
        stage: Stage.Draft,
      },
    },
  };
  hook.unmount();
  const reopened = await setup();

  expect(reopened.result.current.release?.id).toBe(releaseId(6));
  expect(reopened.result.current.recovery).toMatchObject({
    operation: 'review',
    release: { id: releaseId(5) },
  });

  post.mockResolvedValueOnce({
    data: {
      id: releaseId(42),
      taskId: 'TASK-00042',
      type: 'RequestApproval',
      about: { id: releaseId(5), type: 'ontologyRelease' },
    },
  });
  await act(async () => {
    await reopened.result.current.retryRecovery();
  });

  expect(post.mock.calls.map(([url]) => url)).toEqual(['/tasks', '/tasks']);
  expect(post.mock.calls[1][1]).toMatchObject({
    about: '<#E::ontologyRelease::Sales.release-5>',
  });
  expect(reopened.result.current.recovery).toBeNull();
  expect(reopened.result.current.release?.id).toBe(releaseId(6));
});

it('reconciles a lost capture response before allowing the captured Draft to be submitted', async () => {
  currentState = { ...currentState, workingRevision: 8 };
  const hook = await setup();
  post.mockImplementationOnce(async () => {
    const captured = {
      ...makeRelease(6),
      sourceWorkingRevision: 8,
      releaseNotes: 'Pinned notes',
    };
    releases.unshift(captured);
    currentState = { ...currentState, lastReleaseRevision: 6 };
    ontology = {
      ...ontology,
      publicationStatus: {
        ...ontology.publicationStatus,
        unpublishedChanges: 1,
        latest: {
          releaseId: captured.id,
          releaseRevision: 6,
          semanticVersion: captured.semanticVersion,
          stage: Stage.Draft,
        },
      },
    };

    throw new Error('Capture response lost');
  });
  await act(async () => {
    await hook.result.current.captureAndRequestApproval(
      { ...currentState, lastReleaseRevision: 5 },
      { versionBump: VersionBump.Minor, releaseNotes: 'Pinned notes' }
    );
  });

  expect(hook.result.current.recovery?.operation).toBe('capture');

  await act(async () => {
    await hook.result.current.retryRecovery();
  });

  expect(hook.result.current.recovery).toMatchObject({
    operation: 'review',
    release: {
      id: releaseId(6),
      releaseNotes: 'Pinned notes',
      sourceWorkingRevision: 8,
    },
  });
  expect(post).toHaveBeenCalledTimes(1);
});

it('keeps a lost capture unresolved when the bounded history cannot prove its identity', async () => {
  currentState = { ...currentState, workingRevision: 8 };
  const hook = await setup();
  post.mockRejectedValueOnce(new Error('Capture response lost'));
  await act(async () => {
    await hook.result.current.captureAndRequestApproval(currentState, {
      versionBump: VersionBump.Minor,
    });
  });
  hook.unmount();
  const reopened = await setup();
  await act(async () => {
    await reopened.result.current.retryRecovery();
  });

  expect(reopened.result.current.recovery?.operation).toBe('capture');
  expect(reopened.result.current.canWrite).toBe(false);
  expect(post).toHaveBeenCalledTimes(1);
});

it('permits a deliberate new capture after the server definitively rejects the first capture', async () => {
  currentState = { ...currentState, workingRevision: 8 };
  const hook = await setup();
  post.mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } });
  await act(async () => {
    await hook.result.current.capture(currentState, {
      versionBump: VersionBump.Minor,
    });
  });
  post.mockResolvedValueOnce({
    data: { ...makeRelease(6), sourceWorkingRevision: 8 },
  });
  await act(async () => {
    await hook.result.current.capture(currentState, {
      versionBump: VersionBump.Minor,
    });
  });

  expect(post.mock.calls.map(([url]) => url)).toEqual([
    `/ontologies/${owner}/releases`,
    `/ontologies/${owner}/releases`,
  ]);
  expect(hook.result.current.recovery).toBeNull();
});

it.each(['user', 'ontology', 'unmount'] as const)(
  'does not submit a captured release after the %s scope changes',
  async (scope) => {
    currentState = { ...currentState, workingRevision: 8 };
    const hook = await setup();
    let finishCapture: ((value: { data: OntologyRelease }) => void) | undefined;
    post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCapture = resolve;
        })
    );
    let writing: Promise<void> | undefined;
    act(() => {
      writing = hook.result.current.captureAndRequestApproval(currentState, {
        versionBump: VersionBump.Minor,
      });
    });
    await act(async () => {
      if (scope === 'unmount') {
        hook.unmount();
      }
      if (scope === 'user' || scope === 'unmount') {
        useApplicationStore.setState({
          currentUser: {
            id: reviewer,
            name: 'reviewer',
            email: 'reviewer@example.com',
          },
        });
      } else {
        hook.rerender({ ontologyId: releaseId(99) });
      }
    });
    await act(async () => {
      finishCapture?.({
        data: { ...makeRelease(6), sourceWorkingRevision: 8 },
      });
      await writing;
    });

    expect(post.mock.calls.map(([url]) => url)).toEqual([
      `/ontologies/${owner}/releases`,
    ]);

    const stored = JSON.parse(
      sessionStorage.getItem('ontology-publication-receipts-v1') ?? '[]'
    );

    expect(stored).toMatchObject([
      {
        userId: editor,
        ontologyId: owner,
        operation: 'review',
        phase: 'failed',
        release: { id: releaseId(6) },
      },
    ]);
  }
);

it('does not leave the new user busy when an earlier user finishes a capture', async () => {
  currentState = { ...currentState, workingRevision: 8 };
  const hook = await setup();
  let finishCapture: ((value: { data: OntologyRelease }) => void) | undefined;
  post.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishCapture = resolve;
      })
  );
  let writing: Promise<void> | undefined;
  act(() => {
    writing = hook.result.current.capture(currentState, {
      versionBump: VersionBump.Minor,
    });
  });
  await act(async () => {
    useApplicationStore.setState({
      currentUser: {
        id: reviewer,
        name: 'reviewer',
        email: 'reviewer@example.com',
      },
    });
  });
  await act(async () => {
    finishCapture?.({ data: { ...makeRelease(6), sourceWorkingRevision: 8 } });
    await writing;
  });

  expect(hook.result.current.isBusy).toBe(false);
  expect(hook.result.current.canWrite).toBe(true);
});

it('does not expose previous-user state, diff, version baseline or history after an authorization change', async () => {
  const hook = await setup();

  expect(hook.result.current.history.data?.pages[0].data).toHaveLength(2);

  get.mockRejectedValue({ isAxiosError: true, response: { status: 403 } });
  await act(async () => {
    useApplicationStore.setState({
      currentUser: {
        id: reviewer,
        name: 'reviewer',
        email: 'reviewer@example.com',
      },
    });
  });

  expect(hook.result.current.state.data).toBeUndefined();
  expect(hook.result.current.working.data).toBeUndefined();
  expect(hook.result.current.latestVersioned.data).toBeUndefined();
  expect(hook.result.current.history.data).toBeUndefined();
  expect(hook.result.current.canWrite).toBe(false);
});

it('confirms an unknown activation from the active pointer without repeating the PUT', async () => {
  releases[0] = { ...releases[0], entityStatus: EntityStatus.Approved };
  if (!ontology.publicationStatus?.latest) {
    throw new Error('Missing fixture');
  }
  ontology.publicationStatus.latest.stage = Stage.Approved;
  const put = APIClient.put as jest.MockedFunction<typeof APIClient.put>;
  put.mockReset();
  const hook = await setup();
  put.mockImplementationOnce(async () => {
    currentState = {
      ...currentState,
      activeReleaseId: releaseId(5),
      activationRevision: 4,
    };
    ontology = {
      ...ontology,
      publicationStatus: {
        unpublishedChanges: 0,
        reviewLock: {},
        latest: {
          releaseId: releaseId(5),
          releaseRevision: 5,
          semanticVersion: '1.5.0',
          stage: Stage.Published,
        },
        active: { releaseId: releaseId(5), releaseRevision: 5 },
      },
    };

    throw new Error('Activation response lost');
  });
  await act(async () => {
    await hook.result.current.activate({ kind: 'current' });
  });

  expect(hook.result.current.recovery?.operation).toBe('activation');

  await act(async () => {
    await hook.result.current.retryRecovery();
  });

  expect(hook.result.current.recovery).toBeNull();
  expect(hook.result.current.activeReleaseId).toBe(releaseId(5));
  expect(put).toHaveBeenCalledTimes(1);
});

it('recovers the Published projection after overlapping activation refreshes cancel earlier reads', async () => {
  releases[0] = { ...releases[0], entityStatus: EntityStatus.Approved };
  const publicationStatus = ontology.publicationStatus;
  if (!publicationStatus?.latest) {
    throw new Error('Missing fixture');
  }
  const latestRelease = publicationStatus.latest;
  publicationStatus.latest.stage = Stage.Approved;
  const hook = await setup();
  const originalRead = get.getMockImplementation();
  const put = APIClient.put as jest.MockedFunction<typeof APIClient.put>;
  put.mockReset();
  put.mockImplementationOnce(async () => {
    currentState = {
      ...currentState,
      activeReleaseId: releaseId(5),
      activationRevision: 4,
    };
    ontology = {
      ...ontology,
      publicationStatus: {
        ...publicationStatus,
        active: { releaseId: releaseId(5), releaseRevision: 5 },
        latest: { ...latestRelease, stage: Stage.Published },
      },
    };

    return { data: currentState };
  });
  let projectionReads = 0;
  let canceledReads = 0;
  get.mockImplementation((url, config) => {
    if (url === `/ontologies/${owner}` && ++projectionReads <= 2) {
      return new Promise((_, reject) => {
        config?.signal?.addEventListener?.('abort', () => {
          canceledReads += 1;
          reject(new Error('Projection read canceled'));
        });
      });
    }
    if (!originalRead) {
      throw new Error('Missing read fixture');
    }

    return originalRead(url, config);
  });

  let activation: Promise<void> | undefined;
  act(() => {
    activation = hook.result.current.activate({ kind: 'current' });
  });
  await waitFor(() => expect(projectionReads).toBe(2));
  let retry: Promise<void> | undefined;
  await act(async () => {
    retry = hook.result.current.refresh();
    await Promise.all([activation, retry]);
  });

  expect(canceledReads).toBe(2);
  expect(projectionReads).toBe(3);
  expect(hook.result.current.current.kind).toBe('ready');

  if (hook.result.current.current.kind === 'ready') {
    expect(
      hook.result.current.current.value.ontology.publicationStatus?.latest
        ?.stage
    ).toBe(Stage.Published);
  }
});

it('retains the original activation revision when another editor activates elsewhere', async () => {
  releases[0] = { ...releases[0], entityStatus: EntityStatus.Approved };
  if (!ontology.publicationStatus?.latest) {
    throw new Error('Missing fixture');
  }
  ontology.publicationStatus.latest.stage = Stage.Approved;
  const put = APIClient.put as jest.MockedFunction<typeof APIClient.put>;
  put.mockReset();
  put.mockRejectedValueOnce(new Error('Activation response lost'));
  const hook = await setup();
  await act(async () => {
    await hook.result.current.activate({ kind: 'current' });
  });
  currentState = { ...currentState, activationRevision: 4 };
  await act(async () => {
    await hook.result.current.retryRecovery();
  });

  expect(hook.result.current.recovery).toMatchObject({
    operation: 'activation',
    phase: 'conflict',
    state: { activationRevision: 3 },
  });
  expect(put).toHaveBeenCalledTimes(1);
});

it('ends a confirmed activation conflict before a separate deliberate publish uses the fresh revision', async () => {
  releases[0] = { ...releases[0], entityStatus: EntityStatus.Approved };
  if (!ontology.publicationStatus?.latest) {
    throw new Error('Missing fixture');
  }
  ontology.publicationStatus.latest.stage = Stage.Approved;
  const put = APIClient.put as jest.MockedFunction<typeof APIClient.put>;
  put.mockReset();
  put.mockRejectedValueOnce(new Error('Activation response lost'));
  const hook = await setup();
  await act(async () => {
    await hook.result.current.activate({ kind: 'current' });
  });
  currentState = { ...currentState, activationRevision: 4 };
  await act(async () => {
    await hook.result.current.retryRecovery();
  });

  expect(hook.result.current.recovery).toMatchObject({
    phase: 'conflict',
    state: { activationRevision: 3 },
  });

  await act(async () => {
    await hook.result.current.dismissActivationConflict();
  });

  expect(put).toHaveBeenCalledTimes(1);
  expect(hook.result.current.recovery).toBeNull();

  put.mockResolvedValueOnce({
    data: {
      ...currentState,
      activeReleaseId: releaseId(5),
      activationRevision: 5,
    },
  });
  await act(async () => {
    await hook.result.current.activate({ kind: 'current' });
  });

  expect(put.mock.calls.map(([, body]) => body)).toEqual([
    { releaseId: releaseId(5), expectedActivationRevision: 3 },
    { releaseId: releaseId(5), expectedActivationRevision: 4 },
  ]);
});

it('leaves reads available and dispatches no write when recovery storage cannot be used', async () => {
  const storage = jest
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('Storage disabled');
    });
  const hook = await setup();

  expect(hook.result.current.current.kind).toBe('ready');
  expect(hook.result.current.receipt.kind).toBe('unavailable');

  await act(async () => {
    await hook.result.current.captureAndRequestApproval(currentState, {
      versionBump: VersionBump.Minor,
    });
  });

  expect(post).not.toHaveBeenCalled();

  storage.mockRestore();
});

it.each([
  'ontologyId',
  'workingRevision',
  'activationRevision',
  'lastReleaseRevision',
  'activeReleaseId',
] as const)(
  'refuses a changed %s preview fence before capture',
  async (field) => {
    const hook = await setup();
    const stale = {
      ...currentState,
      [field]:
        field === 'ontologyId' || field === 'activeReleaseId'
          ? releaseId(42)
          : 99,
    };
    await act(async () => {
      await hook.result.current.capture(stale, {
        versionBump: VersionBump.Minor,
      });
    });

    expect(hook.result.current.current.kind).toBe('ready');
    expect(post).not.toHaveBeenCalled();
  }
);

it('shows read unavailability after successful task creation and failed refresh without repeating the task', async () => {
  const hook = await setup();
  const originalRead = get.getMockImplementation();
  post.mockImplementationOnce(async () => {
    get.mockImplementation(async (url, config) => {
      if (url === `/ontologies/${owner}`) {
        throw new Error('Refresh failed');
      }
      if (!originalRead) {
        throw new Error('Missing read fixture');
      }

      return originalRead(url, config);
    });

    return {
      data: {
        id: releaseId(42),
        taskId: 'TASK-00042',
        type: 'RequestApproval',
        about: { id: releaseId(5), type: 'ontologyRelease' },
      },
    };
  });
  await act(async () => {
    await hook.result.current.captureAndRequestApproval(currentState, {
      versionBump: VersionBump.Minor,
    });
  });

  expect(hook.result.current.recovery).toBeNull();
  expect(hook.result.current.current.kind).toBe('unavailable');

  await act(async () => {
    await hook.result.current.captureAndRequestApproval(currentState, {
      versionBump: VersionBump.Minor,
    });
  });

  expect(post).toHaveBeenCalledTimes(1);
});

it.each(['owner', 'revision', 'stage', 'active'] as const)(
  'does not invent a stage when the %s read disagrees',
  async (field) => {
    if (field === 'owner') {
      releases[0] = {
        ...releases[0],
        ontology: { id: releaseId(99), type: 'ontology' },
      };
    }
    if (field === 'revision') {
      currentState = { ...currentState, lastReleaseRevision: 6 };
    }
    if (field === 'stage') {
      releases[0] = { ...releases[0], entityStatus: EntityStatus.Approved };
    }
    if (field === 'active') {
      currentState = { ...currentState, activeReleaseId: releaseId(5) };
    }
    const hook = await setup();

    expect(hook.result.current.current.kind).toBe('unavailable');
    expect(hook.result.current.canWrite).toBe(false);
  }
);

it.each(['none', 'caller', 'author', 'deleted'])(
  'does not capture or submit with only an ineffective reviewer: %s',
  async (reason) => {
    if (reason === 'none') {
      ontology.reviewers = [];
    }
    if (reason === 'caller') {
      ontology.reviewers = [{ id: editor, type: 'user', name: 'editor' }];
    }
    if (reason === 'author') {
      releases[0] = { ...releases[0], reviewAuthor: undefined };
      ontology.reviewers = [{ id: reviewer, type: 'user', name: 'author' }];
    }
    if (reason === 'deleted') {
      ontology.reviewers = [
        { id: reviewer, type: 'user', name: 'reviewer', deleted: true },
      ];
    }
    const hook = await setup();
    await act(async () => {
      await hook.result.current.captureAndRequestApproval(currentState, {
        versionBump: VersionBump.Minor,
      });
    });

    expect(post.mock.calls.map(([url]) => url)).toEqual([]);
  }
);

it.each([false, true])(
  'submits only the eligible prospective release when working content changed: %s',
  async (changed) => {
    ontology.reviewers = [{ id: reviewer, type: 'user', name: 'author' }];
    currentState = { ...currentState, workingRevision: changed ? 8 : 7 };
    const original = { ...releases[0] };
    post.mockImplementation(async (url) => {
      if (url === `/ontologies/${owner}/releases`) {
        const captured = {
          ...makeRelease(6),
          sourceWorkingRevision: 8,
          sealedBy: 'editor',
          reviewAuthor: 'editor',
          contentDigest: 'b'.repeat(64),
        };
        releases.unshift(captured);

        return { data: captured };
      }
      if (url === '/tasks') {
        return {
          data: {
            id: releaseId(43),
            taskId: 'TASK-00043',
            type: 'RequestApproval',
            about: { id: releaseId(6), type: 'ontologyRelease' },
          },
        };
      }

      throw new Error(`Unexpected write ${url}`);
    });
    const hook = await setup();
    await act(async () => {
      await hook.result.current.captureAndRequestApproval(currentState, {
        versionBump: VersionBump.Minor,
      });
    });
    if (!changed) {
      expect(post).not.toHaveBeenCalled();

      return;
    }

    expect(post.mock.calls.map(([url]) => url)).toEqual([
      `/ontologies/${owner}/releases`,
      '/tasks',
    ]);
    expect(post.mock.calls[0][1]).toEqual({
      expectedWorkingRevision: 8,
      expectedActivationRevision: 3,
      expectedLatestReleaseRevision: 5,
      versionBump: VersionBump.Minor,
    });
    expect(post.mock.calls[1][1]).toMatchObject({
      about: '<#E::ontologyRelease::Sales.release-6>',
      type: 'RequestApproval',
    });
    expect(releases[0].reviewAuthor).toBe('editor');
    expect(releases.find((entry) => entry.id === original.id)).toEqual(
      original
    );
  }
);

it('captures edited content after rejection without changing the original decision or release', async () => {
  const original = {
    ...releases[0],
    entityStatus: EntityStatus.Rejected,
    reviewTask: releaseId(42),
  };
  releases[0] = original;
  currentState = { ...currentState, workingRevision: 8 };
  if (!ontology.publicationStatus?.latest) {
    throw new Error('Missing fixture');
  }
  ontology.publicationStatus.latest.stage = Stage.ChangesRequested;
  const previous = get.getMockImplementation();
  get.mockImplementation(async (url, config) => {
    const reviewed = releases.find(
      (entry) => url === `/ontologyReleases/${entry.id}/review`
    );
    if (reviewed) {
      return {
        data: {
          ontology: reviewed.ontology,
          release: { id: reviewed.id, type: 'ontologyRelease' },
          task: { id: reviewed.reviewTask, type: 'task' },
          taskId: 'TASK-00042',
          status: reviewed.entityStatus,
          approvalRule: OntologyApprovalRule.AnyReviewer,
          assignees: [
            {
              assignee: { id: reviewer, type: 'user', name: 'reviewer' },
              status: 'Rejected',
            },
          ],
          latestDecision: {
            decision: 'Rejected',
            user: { id: reviewer, type: 'user', name: 'reviewer' },
            reason: 'Keep the original rejection.',
            timestamp: 1,
          },
          callerCanVote: false,
          callerCompletesRule: false,
        },
      };
    }
    if (!previous) {
      throw new Error('Missing fixture');
    }

    return previous(url, config);
  });
  post.mockImplementation(async (url) => {
    if (url === `/ontologies/${owner}/releases`) {
      const captured = {
        ...makeRelease(6),
        sourceWorkingRevision: 8,
        contentDigest: 'b'.repeat(64),
      };
      releases.unshift(captured);
      currentState = { ...currentState, lastReleaseRevision: 6 };
      ontology = {
        ...ontology,
        publicationStatus: {
          ...ontology.publicationStatus,
          unpublishedChanges: 1,
          latest: {
            releaseId: captured.id,
            releaseRevision: 6,
            semanticVersion: captured.semanticVersion,
            stage: Stage.Draft,
          },
        },
      };

      return { data: captured };
    }

    return {
      data: {
        id: releaseId(43),
        taskId: 'TASK-00043',
        type: 'RequestApproval',
        about: { id: releaseId(6), type: 'ontologyRelease' },
      },
    };
  });
  const hook = await setup();
  await act(async () => {
    await hook.result.current.captureAndRequestApproval(currentState, {
      versionBump: VersionBump.Minor,
    });
  });

  expect(post.mock.calls.map(([url]) => url)).toEqual([
    `/ontologies/${owner}/releases`,
    '/tasks',
  ]);
  expect(post.mock.calls[1][1]).toMatchObject({
    about: '<#E::ontologyRelease::Sales.release-6>',
  });
  expect(releases.find((entry) => entry.id === original.id)).toEqual(original);
  expect(original).toMatchObject({
    contentDigest: 'a'.repeat(64),
    reviewTask: releaseId(42),
    entityStatus: EntityStatus.Rejected,
  });
});
