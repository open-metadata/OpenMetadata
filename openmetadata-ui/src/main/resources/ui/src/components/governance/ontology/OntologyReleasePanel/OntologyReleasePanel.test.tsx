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
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import {
  Ontology,
  OntologyApprovalRule,
} from '../../../../generated/entity/data/ontology';
import {
  EncodingVersion,
  EntityStatus,
  LogicalCheck,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import { Stage } from '../../../../generated/type/ontologyPublicationStatus';
import { OntologyState } from '../../../../generated/type/ontologyState';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import APIClient from '../../../../rest/axiosClient';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyPublicationModal from '../OntologyPublicationModal/OntologyPublicationModal';
import OntologyReleasePanel from './OntologyReleasePanel';

jest.mock('../../../../rest/axiosClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const get = APIClient.get as jest.MockedFunction<typeof APIClient.get>;
const post = APIClient.post as jest.MockedFunction<typeof APIClient.post>;
const put = APIClient.put as jest.MockedFunction<typeof APIClient.put>;
const ontology: Ontology = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Sales',
  fullyQualifiedName: 'Sales',
  iri: 'urn:sales',
  namespace: 'urn:sales:',
  version: 0.1,
  reviewers: [
    {
      id: '00000000-0000-4000-8000-000000000003',
      type: 'user',
      name: 'reviewer',
    },
  ],
  approvalRule: OntologyApprovalRule.AnyReviewer,
};
const release: OntologyRelease = {
  id: '00000000-0000-4000-8000-000000000005',
  name: 'Release 1',
  fullyQualifiedName: 'Sales.Release1',
  ontology: { id: ontology.id, type: 'ontology' },
  entityStatus: EntityStatus.Draft,
  releaseRevision: 1,
  semanticVersion: '1.2.3',
  sourceWorkingRevision: 7,
  sealedAt: 1,
  sealedBy: 'author',
  memberCount: 1,
  totalBytes: 100,
  ontologyIri: ontology.iri,
  versionIri: 'urn:sales:v1',
  contentDigest: 'a'.repeat(64),
  encodingVersion: EncodingVersion.OntologyReleaseV1,
  logicalCheck: LogicalCheck.NotRun,
};
const initialState: OntologyState = {
  ontologyId: ontology.id,
  activationRevision: 3,
  workingRevision: 7,
  lastReleaseRevision: 1,
};
let currentState: OntologyState;
let currentRelease: OntologyRelease;
let nextWorkingPage: string | undefined;
let nextPageState: OntologyState | undefined;
let nextPageError: Error | undefined;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
let downloadedBlob: Blob | undefined;
let downloadedFileName: string | undefined;
let anchorClick: jest.SpyInstance;

const renderPanel = async (
  canEdit = true,
  view: 'changes' | 'releases' = 'releases'
) => {
  let result: ReturnType<typeof renderWithQueryClient> | undefined;
  await act(async () => {
    result = renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleasePanel
          canEdit={canEdit}
          ontology={ontology}
          view={view}
        />
      </MemoryRouter>
    );
  });

  if (!result) {
    throw new Error('Publication panel did not render');
  }

  return result;
};

const selectRelease = async () => {
  const button = await screen.findByTestId(
    'ontology-release-select-00000000-0000-4000-8000-000000000005'
  );
  await act(async () => {
    fireEvent.click(button);
  });
};

const workingDiffPage = (after?: string) => {
  const isNextPage = after === 'next-page';

  return {
    data: {
      state: isNextPage ? nextPageState ?? currentState : currentState,
      data: [
        {
          changeType: 'ADDED',
          entity: {
            id: isNextPage ? 'account-id' : 'concept-id',
            name: isNextPage ? 'Account' : 'Customer',
            type: 'ontologyConcept',
          },
          memberKind: 'CONCEPT',
          ontologyId: ontology.id,
        },
      ],
      paging: {
        total: nextWorkingPage ? 2 : 1,
        after: isNextPage ? undefined : nextWorkingPage,
      },
    },
  };
};
const fetchWorkingDiffPage = (after?: string) => {
  if (after && nextPageError) {
    throw nextPageError;
  }

  return workingDiffPage(after);
};

runQueryNotificationsSynchronously();

describe('OntologyReleasePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    useApplicationStore.setState({
      currentUser: {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'editor',
        email: 'editor@example.com',
      },
    });
    downloadedBlob = undefined;
    downloadedFileName = undefined;
    URL.createObjectURL = jest.fn((blob) => {
      if (blob instanceof Blob) {
        downloadedBlob = blob;
      }

      return 'blob:release-export';
    });
    URL.revokeObjectURL = jest.fn();
    anchorClick = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloadedFileName = this.download;
      });
    currentState = { ...initialState };
    currentRelease = { ...release };
    nextWorkingPage = undefined;
    nextPageState = undefined;
    nextPageError = undefined;
    const ownerResponse = (url: string) => {
      if (url === '/ontologies/00000000-0000-4000-8000-000000000001') {
        const stageByStatus: Partial<Record<EntityStatus, Stage>> = {
          [EntityStatus.InReview]: Stage.InReview,
          [EntityStatus.Rejected]: Stage.ChangesRequested,
          [EntityStatus.Approved]:
            currentState.activeReleaseId === currentRelease.id
              ? Stage.Published
              : Stage.Approved,
        };
        const stage = stageByStatus[currentRelease.entityStatus] ?? Stage.Draft;

        return {
          data: {
            ...ontology,
            publicationStatus: {
              unpublishedChanges: 1,
              reviewLock: {},
              latest: {
                releaseId: currentRelease.id,
                releaseRevision: currentRelease.releaseRevision,
                semanticVersion: currentRelease.semanticVersion,
                stage,
              },
              ...(currentState.activeReleaseId
                ? {
                    active: {
                      releaseId: currentState.activeReleaseId,
                      releaseRevision: 1,
                    },
                  }
                : {}),
            },
          },
        };
      }
      if (url.endsWith('/review')) {
        return {
          data: {
            ontology: { id: ontology.id, type: 'ontology' },
            release: { id: currentRelease.id, type: 'ontologyRelease' },
            task: { id: currentRelease.reviewTask, type: 'task' },
            taskId: 'TASK-00042',
            status: currentRelease.entityStatus,
            approvalRule: OntologyApprovalRule.AnyReviewer,
            assignees: [],
            callerCanVote: false,
            callerCompletesRule: false,
            ...(currentRelease.entityStatus === EntityStatus.Rejected
              ? {
                  latestDecision: {
                    decision: 'Rejected',
                    user: { id: 'reviewer', type: 'user', name: 'Reviewer' },
                    reason: 'Fix the definition',
                    timestamp: 1,
                  },
                }
              : {}),
          },
        };
      }

      return undefined;
    };
    const releaseResponse = (url: string) => {
      if (url === `/ontologyReleases/${currentRelease.id}`) {
        return { data: currentRelease };
      }
      if (url === `/ontologyReleases/${release.id}`) {
        return { data: release };
      }
      if (url === '/ontologyReleases/00000000-0000-4000-8000-000000000006') {
        return {
          data: {
            ...release,
            id: '00000000-0000-4000-8000-000000000006',
            name: 'Release 2',
            releaseRevision: 2,
            entityStatus: EntityStatus.Approved,
          },
        };
      }
      if (url.endsWith('/validation')) {
        const header = url.includes(currentRelease.id)
          ? currentRelease
          : release;

        return {
          data: {
            releaseId: url.split('/')[2],
            contentDigest: header.contentDigest,
            baseReleaseId: header.baseReleaseId,
            valid: true,
            structure: {
              releaseId: url.split('/')[2],
              contentDigest: header.contentDigest,
              valid: true,
              violationCount: 0,
              violations: [],
            },
            shacl: {
              findings: [],
              violationCount: 0,
              warningCount: 0,
              truncated: false,
            },
            deprecationImpacts: [],
            logicalCheck: 'NOT_RUN',
          },
        };
      }

      return undefined;
    };
    get.mockImplementation(async (url, config) => {
      const response = ownerResponse(url) ?? releaseResponse(url);
      if (response) {
        return response;
      }
      if (url.endsWith('/state')) {
        return { data: currentState };
      }
      if (url.endsWith('/working/diff')) {
        return fetchWorkingDiffPage(
          (config?.params as { after?: string })?.after
        );
      }
      if (url.endsWith('/diff')) {
        return { data: { data: [], paging: { total: 0 } } };
      }
      if (url.endsWith('/export')) {
        return { data: 'sealed release content' };
      }
      if (url.endsWith('/events')) {
        return { data: { data: [], paging: { total: 0 } } };
      }
      if (url === '/ontologies/00000000-0000-4000-8000-000000000001/releases') {
        return { data: { data: [currentRelease], paging: { total: 1 } } };
      }

      throw new Error(`Unexpected request: ${url}`);
    });
  });

  afterEach(() => {
    anchorClick.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('separates working changes from release history for the publication modal', async () => {
    await renderPanel(true, 'changes');

    expect(
      await screen.findByRole('button', { name: 'label.capture-release' })
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'label.ontology-release' })
    ).not.toBeInTheDocument();

    cleanup();
    await renderPanel(true, 'releases');

    expect(await screen.findByTestId('ontology-release-history')).toBeVisible();
    expect(screen.getByTestId('ontology-release-history')).toBeVisible();
  });

  it('shows active release details only after selecting its history row', async () => {
    currentState.activeReleaseId = release.id;
    currentRelease.entityStatus = EntityStatus.Approved;
    await renderPanel();

    expect(
      await screen.findByTestId(
        'ontology-release-select-00000000-0000-4000-8000-000000000005'
      )
    ).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByTestId('ontology-release-definition')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'label.export' })).toBeEnabled();

    await selectRelease();

    expect(
      await screen.findByTestId('ontology-release-definition')
    ).toBeVisible();
    expect(screen.getByTestId('ontology-active-release')).toBeVisible();
    expect(
      screen.getByTestId(
        'ontology-release-select-00000000-0000-4000-8000-000000000005'
      )
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it.each([
    ['turtle', 'label.turtle-ttl', 'ttl', 'text/turtle'],
    ['rdfxml', 'label.rdf-xml-rdf', 'rdf', 'application/rdf+xml'],
    ['ntriples', 'label.n-triples-nt', 'nt', 'application/n-triples'],
    ['jsonld', 'label.json-ld', 'jsonld', 'application/ld+json'],
  ])(
    'downloads the selected sealed release as %s for a reader',
    async (format, label, extension, mimeType) => {
      await renderPanel(false);
      await selectRelease();
      fireEvent.click(
        await screen.findByRole('button', { name: 'label.export' })
      );
      fireEvent.click(await screen.findByRole('menuitem', { name: label }));

      await waitFor(() => expect(downloadedBlob).toBeInstanceOf(Blob));

      expect(get).toHaveBeenCalledWith(
        '/ontologyReleases/00000000-0000-4000-8000-000000000005/export',
        {
          params: { format },
          headers: { Accept: mimeType },
          responseType: 'text',
        }
      );
      expect(downloadedFileName).toBe(
        `ontology-release-00000000-0000-4000-8000-000000000005.${extension}`
      );
      expect(downloadedBlob?.type).toBe(mimeType);

      const blob = downloadedBlob;
      if (!blob) {
        throw new Error('No release file was downloaded');
      }
      const content = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsText(blob);
      });

      expect(content).toBe('sealed release content');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:release-export');
      expect(post).not.toHaveBeenCalled();
      expect(put).not.toHaveBeenCalled();
    }
  );

  it('reports a denied export without downloading and permits retry', async () => {
    const requests = get.getMockImplementation();
    if (!requests) {
      throw new Error('Missing API fixture');
    }
    const denied = new AxiosError(
      'An imported definition is not readable',
      '403'
    );
    get.mockImplementation((url, config) =>
      url.endsWith('/export') ? Promise.reject(denied) : requests(url, config)
    );
    await renderPanel();
    await selectRelease();
    fireEvent.click(
      await screen.findByRole('button', { name: 'label.export' })
    );
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'label.turtle-ttl' })
    );
    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(denied));

    expect(downloadedBlob).toBeUndefined();
    expect(screen.getByRole('button', { name: 'label.export' })).toBeEnabled();

    get.mockImplementation(requests);
    fireEvent.click(screen.getByRole('button', { name: 'label.export' }));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'label.turtle-ttl' })
    );
    await waitFor(() =>
      expect(downloadedFileName).toBe(
        'ontology-release-00000000-0000-4000-8000-000000000005.ttl'
      )
    );
  });

  it('captures the displayed working revision without approving or activating it', async () => {
    post.mockImplementation(async () => {
      currentRelease = {
        ...release,
        id: '00000000-0000-4000-8000-000000000007',
        releaseRevision: 2,
        semanticVersion: '1.3.0',
      };
      currentState = { ...currentState, lastReleaseRevision: 2 };

      return { data: currentRelease };
    });
    await renderPanel(true, 'changes');

    expect(await screen.findByText(/Customer/)).toBeVisible();
    expect(screen.getByText('1 label.pending-changes')).toBeVisible();

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'label.capture-release' })
      ).toBeEnabled()
    );
    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'label.capture-release' })
      )
    );

    await screen.findByTestId('ontology-release-definition');

    expect(post).toHaveBeenCalledWith(
      '/ontologies/00000000-0000-4000-8000-000000000001/releases',
      {
        expectedActivationRevision: 3,
        expectedWorkingRevision: 7,
        expectedLatestReleaseRevision: 1,
        versionBump: 'minor',
        releaseNotes: '',
      }
    );
    expect(put).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'label.activate-release' })
    ).toBeDisabled();
    expect(
      screen.getByText('message.ontology-consistency-not-run')
    ).toBeInTheDocument();
  });

  it('follows two captures in Changes while keeping their revision fences and release details aligned', async () => {
    const captures = [
      {
        ...release,
        id: '00000000-0000-4000-8000-000000000006',
        name: 'Captured R6',
        releaseRevision: 2,
        sourceWorkingRevision: 7,
        semanticVersion: '1.3.0',
        contentDigest: 'b'.repeat(64),
      },
      {
        ...release,
        id: '00000000-0000-4000-8000-000000000007',
        name: 'Captured R7',
        releaseRevision: 3,
        sourceWorkingRevision: 8,
        semanticVersion: '1.4.0',
        contentDigest: 'c'.repeat(64),
      },
    ];
    post.mockImplementation(async () => {
      const next = captures[post.mock.calls.length - 1];
      currentRelease = next;
      currentState = {
        ...currentState,
        lastReleaseRevision: next.releaseRevision,
        workingRevision: next.sourceWorkingRevision + 1,
      };

      return { data: next };
    });
    const { queryClient } = await renderPanel(true, 'changes');
    const capture = async () => {
      await act(async () => {
        fireEvent.click(screen.getByTestId('ontology-capture-release'));
      });
    };

    await screen.findByText(/Customer/);
    await capture();

    expect(await screen.findByText('Captured R6')).toBeVisible();

    await capture();

    expect(post).toHaveBeenNthCalledWith(
      1,
      `/ontologies/${ontology.id}/releases`,
      expect.objectContaining({
        expectedWorkingRevision: 7,
        expectedActivationRevision: 3,
        expectedLatestReleaseRevision: 1,
      })
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      `/ontologies/${ontology.id}/releases`,
      expect.objectContaining({
        expectedWorkingRevision: 8,
        expectedActivationRevision: 3,
        expectedLatestReleaseRevision: 2,
      })
    );
    expect(await screen.findByText('Captured R7')).toBeVisible();
    expect(screen.queryByText('Captured R6')).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-release-stage')).toHaveTextContent(
      'label.draft'
    );
    expect(
      get.mock.calls.some(
        ([url]) => url === `/ontologyReleases/${captures[1].id}/validation`
      )
    ).toBe(true);
    expect(
      get.mock.calls.some(
        ([url]) => url === `/ontologyReleases/${captures[1].id}/events`
      )
    ).toBe(true);

    fireEvent.click(
      screen.getByTestId(`ontology-release-export-${captures[1].id}`)
    );
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'label.turtle-ttl' })
    );
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        `/ontologyReleases/${captures[1].id}/export`,
        expect.objectContaining({ params: { format: 'turtle' } })
      )
    );

    currentRelease = { ...currentRelease, entityStatus: EntityStatus.Approved };
    await act(async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['ontology-publication', ontology.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['ontology-release', ontology.id, captures[1].id],
        }),
      ]);
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'label.activate-release' })
      ).toBeEnabled()
    );
    put.mockImplementation(async () => {
      currentState = {
        ...currentState,
        activeReleaseId: captures[1].id,
        activationRevision: 4,
      };

      return { data: currentState };
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'label.activate-release' })
      );
    });

    expect(put).toHaveBeenCalledWith(`/ontologies/${ontology.id}/activation`, {
      releaseId: captures[1].id,
      expectedActivationRevision: 3,
    });
  });

  it('pages pending change labels before capture', async () => {
    nextWorkingPage = 'next-page';
    await renderPanel(true, 'changes');

    expect(await screen.findByText(/Customer/)).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-working-next'));

    expect(await screen.findByText(/Account/)).toBeVisible();
    expect(screen.getByText('2 label.pending-changes')).toBeVisible();
    expect(screen.queryByText(/Customer/)).not.toBeInTheDocument();
  });

  it('reports the captured structural result and leaves logical consistency unchecked', async () => {
    const requests = get.getMockImplementation();
    get.mockImplementation(async (url, config) => {
      if (url.endsWith('/validation')) {
        return {
          data: {
            releaseId: release.id,
            contentDigest: release.contentDigest,
            baseReleaseId: release.baseReleaseId,
            valid: false,
            structure: {
              releaseId: release.id,
              contentDigest: release.contentDigest,
              valid: false,
              violationCount: 2,
              violations: [],
            },
            shacl: {
              findings: [],
              violationCount: 0,
              warningCount: 0,
              truncated: false,
            },
            deprecationImpacts: [],
            logicalCheck: 'NOT_RUN',
          },
        };
      }
      if (!requests) {
        throw new Error('Missing API fixture');
      }

      return requests(url, config);
    });
    post.mockResolvedValue({ data: release });
    await renderPanel(true, 'changes');

    expect(get.mock.calls.some(([url]) => url.endsWith('/validation'))).toBe(
      true
    );

    expect(
      await screen.findByText(/label.structural-validation.*label.failed/)
    ).toBeVisible();
    expect(
      screen.getByText(/label.logical-consistency.*label.not-checked/)
    ).toBeVisible();
    expect(screen.getByTestId('ontology-shacl-counts')).toHaveTextContent(
      '0 label.violation-plural'
    );
  });

  it('does not submit review when the latest release fence rejects capture', async () => {
    currentState = { ...currentState, workingRevision: 8 };
    const conflict = new AxiosError('Latest release changed', '409');
    post.mockRejectedValue(conflict);
    await renderPanel(true, 'changes');
    await act(async () =>
      fireEvent.click(screen.getByTestId('ontology-request-review'))
    );

    expect(showErrorToast).toHaveBeenCalledWith(conflict);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/ontologies/00000000-0000-4000-8000-000000000001/releases',
      expect.objectContaining({ expectedLatestReleaseRevision: 1 })
    );
    expect(put).not.toHaveBeenCalled();
  });

  it('blocks capture and current review on a stale cursor and retries from the first page', async () => {
    nextWorkingPage = 'next-page';
    nextPageError = Object.assign(new AxiosError('Stale cursor'), {
      response: { status: 412 },
    });
    await renderPanel(true, 'changes');

    expect(await screen.findByText(/Customer/)).toBeVisible();
    expect(screen.getByTestId('ontology-request-review')).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('ontology-working-next'));
    });

    expect(
      await screen.findByText('message.ontology-review-unavailable')
    ).toBeVisible();
    expect(screen.getByTestId('ontology-capture-release')).toBeDisabled();
    expect(screen.getByTestId('ontology-request-review')).toBeDisabled();
    expect(screen.queryByText(/Account/)).not.toBeInTheDocument();

    nextPageError = undefined;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
    });

    expect(await screen.findByText(/Customer/)).toBeVisible();
    expect(screen.getByTestId('ontology-working-previous')).toBeDisabled();
    expect(screen.getByTestId('ontology-capture-release')).toBeEnabled();
    expect(screen.getByTestId('ontology-request-review')).toBeEnabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('resets pagination when the first-page revision changes', async () => {
    nextWorkingPage = 'next-page';
    const { queryClient } = await renderPanel(true, 'changes');

    expect(await screen.findByText(/Customer/)).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-working-next'));

    expect(await screen.findByText(/Account/)).toBeVisible();

    currentState = { ...currentState, workingRevision: 8 };
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ['ontology-working-diff', ontology.id, undefined],
      });
    });

    expect(await screen.findByText(/Customer/)).toBeVisible();
    expect(screen.queryByText(/Account/)).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-working-previous')).toBeDisabled();
  });

  it('blocks capture if the paged result does not match its first-page revision', async () => {
    nextWorkingPage = 'next-page';
    nextPageState = { ...initialState, workingRevision: 8 };
    await renderPanel(true, 'changes');

    expect(await screen.findByText(/Customer/)).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-working-next'));

    expect(
      await screen.findByText('message.ontology-review-unavailable')
    ).toBeVisible();
    expect(screen.queryByText(/Account/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.capture-release' })
    ).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('submits the whole sealed release through the existing Tasks workflow', async () => {
    post.mockResolvedValue({
      data: {
        id: '00000000-0000-4000-8000-000000000042',
        category: 'Approval',
        type: 'RequestApproval',
        name: 'Review release',
        status: 'Open',
        taskId: 'TASK-00042',
        about: { id: release.id, type: 'ontologyRelease' },
      },
    });
    await renderPanel();
    await selectRelease();
    const request = await screen.findByRole('button', {
      name: 'label.request-review',
    });
    await act(async () => fireEvent.click(request));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/tasks',
        expect.objectContaining({
          category: 'Approval',
          type: 'RequestApproval',
          about: '<#E::ontologyRelease::Sales.Release1>',
        })
      )
    );

    expect(put).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'retains captured metadata across modal tabs and reconciles a known failure or unknown success: %s',
    async (taskWasCreated) => {
      currentState = { ...currentState, workingRevision: 8 };
      let taskAttempts = 0;
      post.mockImplementation(async (url) => {
        if (
          url === '/ontologies/00000000-0000-4000-8000-000000000001/releases'
        ) {
          currentRelease = {
            ...release,
            id: '00000000-0000-4000-8000-000000000007',
            semanticVersion: '1.2.4',
            releaseRevision: 2,
            sourceWorkingRevision: 8,
            releaseNotes: 'Fix customer aliases',
          };
          currentState = { ...currentState, lastReleaseRevision: 2 };

          return { data: currentRelease };
        }
        if (url === '/tasks') {
          taskAttempts++;
          if (taskAttempts === 1) {
            if (taskWasCreated) {
              currentRelease = {
                ...currentRelease,
                entityStatus: EntityStatus.InReview,
                reviewTask: '00000000-0000-4000-8000-000000000043',
              };

              throw new Error('Task response lost');
            }

            throw Object.assign(new AxiosError('Task rejected'), {
              response: { status: 400 },
            });
          }
          currentRelease = {
            ...currentRelease,
            entityStatus: EntityStatus.InReview,
            reviewTask: '00000000-0000-4000-8000-000000000044',
          };

          return {
            data: {
              id: currentRelease.reviewTask,
              taskId: 'TASK-00042',
              type: 'RequestApproval',
              about: { id: currentRelease.id, type: 'ontologyRelease' },
            },
          };
        }

        throw new Error('Unexpected write: ' + url);
      });
      await act(async () => {
        renderWithQueryClient(
          <MemoryRouter>
            <OntologyPublicationModal
              canEdit
              ontology={ontology}
              onClose={jest.fn()}
            />
          </MemoryRouter>
        );
      });
      fireEvent.click(
        await screen.findByRole('radio', { name: /label.version-patch/ })
      );
      fireEvent.change(
        screen.getByRole('textbox', { name: /label.release-notes/ }),
        { target: { value: 'Fix customer aliases' } }
      );

      expect(screen.getByTestId('ontology-version-preview')).toHaveTextContent(
        '1.2.3 → 1.2.4'
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('ontology-request-review'));
      });

      expect(
        await screen.findByTestId('ontology-capture-release')
      ).toBeDisabled();

      await act(async () => {
        fireEvent.click(
          screen.getByTestId('ontology-publication-tab-releases')
        );
      });
      await screen.findByTestId(
        'ontology-release-select-00000000-0000-4000-8000-000000000007'
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId('ontology-publication-tab-changes'));
      });

      expect(
        screen.getByRole('textbox', { name: /label.release-notes/ })
      ).toHaveValue('Fix customer aliases');

      if (screen.queryByTestId('ontology-recovery-action')) {
        await act(async () => {
          fireEvent.click(screen.getByTestId('ontology-recovery-action'));
        });
      }

      expect(
        post.mock.calls.filter(([url]) => url.endsWith('/releases'))
      ).toEqual([
        [
          '/ontologies/00000000-0000-4000-8000-000000000001/releases',
          {
            expectedActivationRevision: 3,
            expectedWorkingRevision: 8,
            expectedLatestReleaseRevision: 1,
            versionBump: 'patch',
            releaseNotes: 'Fix customer aliases',
          },
        ],
      ]);
      expect(taskAttempts).toBe(taskWasCreated ? 1 : 2);
      expect(screen.getByTestId('ontology-release-stage')).toHaveTextContent(
        'label.in-review'
      );
      expect(screen.getByRole('link', { name: 'TASK-00042' })).toHaveAttribute(
        'href',
        '/tasks/' + currentRelease.reviewTask
      );
      expect(put).not.toHaveBeenCalled();
    }
  );

  it('opens the native task UUID through the Studio callback', async () => {
    currentRelease = {
      ...release,
      entityStatus: EntityStatus.InReview,
      reviewTask: 'native-task-uuid',
    };
    currentState = { ...initialState, lastReleaseRevision: 1 };
    const onOpenTask = jest.fn();
    await act(async () => {
      renderWithQueryClient(
        <MemoryRouter>
          <OntologyReleasePanel
            canEdit
            ontology={ontology}
            view="changes"
            onOpenTask={onOpenTask}
          />
        </MemoryRouter>
      );
    });
    fireEvent.click(
      await screen.findByRole('button', { name: /label.open-task/ })
    );

    expect(onOpenTask).toHaveBeenCalledWith('native-task-uuid');
    expect(
      screen.queryByRole('link', { name: 'TASK-00042' })
    ).not.toBeInTheDocument();
  });

  it('loads newest-first owner history with numeric cursors and release events', async () => {
    currentState = { ...currentState, lastReleaseRevision: 2 };
    currentRelease = { ...currentRelease, releaseRevision: 2 };
    const originalGet = get.getMockImplementation();
    get.mockImplementation(async (url, config) => {
      if (url === '/ontologies/00000000-0000-4000-8000-000000000001/releases') {
        const after = (config?.params as { after?: string })?.after;
        const older = {
          ...release,
          id: '00000000-0000-4000-8000-000000000004',
          semanticVersion: '1.1.0',
          releaseRevision: 1,
        };

        return {
          data: {
            data: after
              ? [older]
              : [
                  {
                    ...currentRelease,
                    releaseRevision: 2,
                    releaseNotes: 'Customer identity',
                  },
                ],
            paging: { total: 2, after: after ? undefined : '2' },
          },
        };
      }
      if (url.endsWith('/events')) {
        return {
          data: {
            data: [
              {
                id: 'event-id',
                releaseId: currentRelease.id,
                ontologyId: ontology.id,
                eventType: 'APPROVED',
                createdBy: 'reviewer',
                createdAt: 1,
                contentDigest: release.contentDigest,
                voters: ['reviewer'],
              },
            ],
            paging: { total: 1 },
          },
        };
      }
      if (!originalGet) {
        throw new Error('Missing API fixture');
      }

      return originalGet(url, config);
    });
    await renderPanel();

    expect(await screen.findByText('Customer identity')).toBeVisible();

    await act(async () =>
      fireEvent.click(screen.getByTestId('ontology-release-load-more'))
    );

    expect(
      await screen.findByTestId(
        'ontology-release-select-00000000-0000-4000-8000-000000000004'
      )
    ).toBeVisible();
    expect(get).toHaveBeenCalledWith(
      '/ontologies/00000000-0000-4000-8000-000000000001/releases',
      expect.objectContaining({ params: { limit: 25, after: '2' } })
    );

    await act(async () => selectRelease());

    expect(
      await screen.findByText(/label.ontology-event-approved/)
    ).toBeVisible();
    expect(get.mock.calls.some(([url]) => url === '/ontologyReleases')).toBe(
      false
    );
  });

  it.each([undefined, '00000000-0000-4000-8000-000000000006'])(
    'refreshes activation actor and time in the mounted release panel from %s',
    async (activeReleaseId) => {
      currentState.activeReleaseId = activeReleaseId;
      currentRelease.entityStatus = EntityStatus.Approved;
      let activated = false;
      const originalGet = get.getMockImplementation();
      get.mockImplementation(async (url, config) => {
        if (url.endsWith('/events')) {
          const data =
            url ===
            '/ontologyReleases/00000000-0000-4000-8000-000000000005/events'
              ? [
                  {
                    id: 'captured-event',
                    releaseId: release.id,
                    eventType: 'CAPTURED',
                    createdBy: 'capture-author',
                    createdAt: 1000,
                  },
                  ...(activated
                    ? [
                        {
                          id: 'activated-event',
                          releaseId: release.id,
                          eventType: 'ACTIVATED',
                          createdBy: 'activation-author',
                          createdAt: 2000,
                        },
                      ]
                    : []),
                ]
              : [];

          return { data: { data, paging: { total: data.length } } };
        }
        if (!originalGet) {
          throw new Error('Missing API fixture');
        }

        return originalGet(url, config);
      });
      put.mockImplementation(async () => {
        activated = true;
        currentState = {
          ...currentState,
          activeReleaseId: release.id,
          activationRevision: 4,
        };

        return { data: currentState };
      });
      await renderPanel();
      await selectRelease();

      expect(await screen.findByText(/capture-author/)).toBeVisible();
      expect(screen.queryByText(/activation-author/)).not.toBeInTheDocument();

      const mounted = screen.getByTestId('ontology-release-definition');
      fireEvent.click(
        screen.getByRole('button', { name: 'label.activate-release' })
      );

      expect(await screen.findByText(/activation-author/)).toHaveTextContent(
        new Date(2000).toLocaleString()
      );
      expect(screen.getByTestId('ontology-release-definition')).toBe(mounted);
      expect(screen.getByTestId('ontology-active-release')).toBeVisible();
    }
  );

  it.each(['coherent', 'failed', 'incoherent'] as const)(
    'settles automatic activation refreshes with a %s projection',
    async (projectionResult) => {
      currentRelease = {
        ...release,
        entityStatus: EntityStatus.Approved,
        reviewTask: '00000000-0000-4000-8000-000000000045',
      };
      currentState.workingRevision = release.sourceWorkingRevision + 1;
      const requests = get.getMockImplementation();
      if (!requests) {
        throw new Error('Missing API fixture');
      }
      let activated = false;
      let projectionReads = 0;
      let abortedReads = 0;
      let resolveRelease: (() => void) | undefined;
      let resolveReview: (() => void) | undefined;
      get.mockImplementation((url, config) => {
        if (!activated) {
          return requests(url, config);
        }
        if (url === `/ontologies/${ontology.id}`) {
          projectionReads += 1;
          if (projectionReads <= 2) {
            return new Promise((_, reject) => {
              config?.signal?.addEventListener?.('abort', () => {
                abortedReads += 1;
                reject(new Error('Projection read canceled'));
              });
            });
          }
          if (projectionResult === 'failed') {
            return Promise.reject(
              new AxiosError('Projection unavailable', '503')
            );
          }
          if (projectionResult === 'incoherent') {
            return Promise.resolve({
              data: {
                ...ontology,
                publicationStatus: {
                  unpublishedChanges: 1,
                  reviewLock: {},
                  latest: {
                    releaseId: currentRelease.id,
                    releaseRevision: currentRelease.releaseRevision,
                    semanticVersion: currentRelease.semanticVersion,
                    stage: Stage.Approved,
                  },
                },
              },
            });
          }
        }
        if (url === `/ontologyReleases/${release.id}`) {
          return new Promise((resolve) => {
            resolveRelease = () => resolve(requests(url, config));
          });
        }
        if (url.endsWith('/review')) {
          return new Promise((resolve) => {
            resolveReview = () => resolve(requests(url, config));
          });
        }

        return requests(url, config);
      });
      put.mockImplementation(async () => {
        activated = true;
        currentState = {
          ...currentState,
          activeReleaseId: release.id,
          activationRevision: 4,
        };

        return { data: currentState };
      });
      const { queryClient } = await renderPanel();
      await selectRelease();

      expect(
        await screen.findByTestId('ontology-release-stage')
      ).toHaveTextContent('label.approved');

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: 'label.activate-release' })
        );
      });
      await waitFor(() => expect(projectionReads).toBe(1));

      expect(resolveRelease).toBeDefined();
      expect(resolveReview).toBeDefined();

      const systemTime = Date.now();
      jest.setSystemTime(Date.now() + 1);
      await act(async () => resolveRelease?.());
      await waitFor(() => expect(projectionReads).toBe(2));
      jest.setSystemTime(Date.now() + 1);
      await act(async () => resolveReview?.());
      await waitFor(() => expect(projectionReads).toBe(3));
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      jest.setSystemTime(systemTime);

      expect(abortedReads).toBe(2);
      expect(screen.getByTestId('ontology-active-release')).toBeVisible();

      if (projectionResult === 'coherent') {
        expect(screen.getByTestId('ontology-release-stage')).toHaveTextContent(
          'label.published'
        );
        expect(
          screen.queryByText('message.ontology-review-unavailable')
        ).not.toBeInTheDocument();
      } else {
        expect(
          screen.queryByTestId('ontology-release-stage')
        ).not.toBeInTheDocument();
        expect(
          screen.getByText('message.ontology-review-unavailable')
        ).toBeVisible();
      }
    }
  );

  it('does not activate an already active release again', async () => {
    currentState.activeReleaseId = release.id;
    currentRelease.entityStatus = EntityStatus.Approved;
    currentRelease.id = '00000000-0000-4000-8000-000000000005';
    put.mockImplementation(async () => {
      currentState = { ...currentState, activationRevision: 4 };

      return { data: currentState };
    });
    await renderPanel();
    await selectRelease();
    await screen.findByTestId('ontology-release-definition');

    expect(
      screen.getByRole('button', { name: 'label.activate-release' })
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: 'label.request-approval' })
    ).not.toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });

  it('retains a rejected decision and requires a new capture for another review', async () => {
    currentRelease = {
      ...release,
      entityStatus: EntityStatus.Rejected,
      reviewTask: '00000000-0000-4000-8000-000000000045',
    };
    await renderPanel();
    await selectRelease();

    expect(
      await screen.findByRole('link', { name: 'label.approval' })
    ).toHaveAttribute('href', '/tasks/00000000-0000-4000-8000-000000000045');
    expect(
      screen.queryByRole('button', { name: 'label.request-approval' })
    ).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('links to the pending workflow without allowing a second submission', async () => {
    currentRelease = {
      ...release,
      entityStatus: EntityStatus.InReview,
      reviewTask: '00000000-0000-4000-8000-000000000046',
    };
    await renderPanel();
    await selectRelease();
    await screen.findByRole('link', { name: 'label.approval' });

    expect(
      screen.queryByRole('button', { name: 'label.request-approval' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.activate-release' })
    ).toBeDisabled();
  });

  it('rolls back to an older approved release using the displayed activation revision', async () => {
    currentState.activeReleaseId = '00000000-0000-4000-8000-000000000006';
    currentRelease.entityStatus = EntityStatus.Approved;
    put.mockImplementation(async () => {
      currentState = {
        ...currentState,
        activeReleaseId: release.id,
        activationRevision: 4,
      };

      return { data: currentState };
    });
    await renderPanel();
    await selectRelease();
    await screen.findByTestId('ontology-release-definition');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'label.activate-release' })
      ).toBeEnabled()
    );
    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'label.activate-release' })
      )
    );

    expect(put).toHaveBeenCalledWith(
      '/ontologies/00000000-0000-4000-8000-000000000001/activation',
      {
        releaseId: '00000000-0000-4000-8000-000000000005',
        expectedActivationRevision: 3,
      }
    );
    expect(
      await screen.findByTestId('ontology-active-release')
    ).toBeInTheDocument();
  });

  it('lists sealed releases when working definitions cannot be read', async () => {
    const requests = get.getMockImplementation();
    if (!requests) {
      throw new Error('Missing API fixture');
    }
    get.mockImplementation((url, config) =>
      url.endsWith('/working/diff')
        ? Promise.reject(
            new AxiosError('Working definitions unavailable', '403')
          )
        : requests(url, config)
    );

    await renderPanel(false);

    expect(
      screen.getByTestId(
        'ontology-release-select-00000000-0000-4000-8000-000000000005'
      )
    ).toBeVisible();

    await selectRelease();

    expect(
      await screen.findByTestId('ontology-release-definition')
    ).toBeVisible();
    expect(put).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('rolls back with the current activation revision after the working diff fails', async () => {
    currentState.activeReleaseId = '00000000-0000-4000-8000-000000000006';
    currentRelease.entityStatus = EntityStatus.Approved;
    const { queryClient } = await renderPanel();
    await selectRelease();
    await screen.findByTestId('ontology-release-definition');
    currentState = { ...currentState, activationRevision: 4 };
    const requests = get.getMockImplementation();
    if (!requests) {
      throw new Error('Missing API fixture');
    }
    get.mockImplementation((url, config) =>
      url.endsWith('/working/diff')
        ? Promise.reject(
            new AxiosError('Working definitions unavailable', '403')
          )
        : requests(url, config)
    );
    put.mockImplementation(async () => {
      currentState = {
        ...currentState,
        activeReleaseId: release.id,
        activationRevision: 5,
      };

      return { data: currentState };
    });
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    expect(
      screen.getByRole('button', { name: 'label.activate-release' })
    ).toBeEnabled();

    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'label.activate-release' })
      )
    );

    expect(put).toHaveBeenCalledWith(
      '/ontologies/00000000-0000-4000-8000-000000000001/activation',
      {
        releaseId: '00000000-0000-4000-8000-000000000005',
        expectedActivationRevision: 4,
      }
    );
    expect(await screen.findByTestId('ontology-active-release')).toBeVisible();
  });

  it('blocks capture when the working diff is unavailable', async () => {
    const requests = get.getMockImplementation();
    if (!requests) {
      throw new Error('Missing API fixture');
    }
    get.mockImplementation((url, config) =>
      url.endsWith('/working/diff')
        ? Promise.reject(
            new AxiosError('Working definitions unavailable', '403')
          )
        : requests(url, config)
    );
    await renderPanel(true, 'changes');

    expect(
      await screen.findByText('message.ontology-review-unavailable')
    ).toBeVisible();
    expect(screen.getByTestId('ontology-capture-release')).toBeDisabled();
    expect(screen.getByTestId('ontology-request-review')).toBeDisabled();

    fireEvent.click(screen.getByTestId('ontology-capture-release'));

    expect(post).not.toHaveBeenCalled();
  });

  it('keeps history readable but blocks activation while state refreshes or fails', async () => {
    currentState.activeReleaseId = '00000000-0000-4000-8000-000000000006';
    currentRelease.entityStatus = EntityStatus.Approved;
    const { queryClient } = await renderPanel();
    await selectRelease();
    await screen.findByTestId('ontology-release-definition');

    expect(
      screen.getByRole('button', { name: 'label.activate-release' })
    ).toBeEnabled();

    const requests = get.getMockImplementation();
    if (!requests) {
      throw new Error('Missing API fixture');
    }
    let rejectState: ((error: AxiosError) => void) | undefined;
    get.mockImplementation((url, config) =>
      url.endsWith('/state')
        ? new Promise((_resolve, reject) => {
            rejectState = reject;
          })
        : requests(url, config)
    );
    await act(async () => {
      void queryClient.invalidateQueries({
        queryKey: ['ontology-state', ontology.id],
      });
    });

    expect(
      screen.getByRole('button', { name: 'label.activate-release' })
    ).toBeDisabled();

    await act(async () => {
      rejectState?.(new AxiosError('State unavailable', '403'));
    });

    expect(
      screen.getByText('message.ontology-review-unavailable')
    ).toBeVisible();
    expect(
      screen.getByTestId(
        'ontology-release-select-00000000-0000-4000-8000-000000000005'
      )
    ).toBeVisible();
    expect(screen.getByTestId('ontology-release-definition')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'label.activate-release' })
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: 'label.activate-release' })
    );

    expect(put).not.toHaveBeenCalled();

    get.mockImplementation(requests);
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'label.retry' }))
    );

    expect(
      screen.queryByText('message.ontology-review-unavailable')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.activate-release' })
    ).toBeEnabled();
  });

  it('keeps the active pointer unchanged when the server rejects a stale activation', async () => {
    currentState.activeReleaseId = '00000000-0000-4000-8000-000000000006';
    currentRelease.entityStatus = EntityStatus.Approved;
    const conflict = new AxiosError('Activation revision changed', '409');
    put.mockRejectedValue(conflict);
    await renderPanel();
    await selectRelease();
    await screen.findByTestId('ontology-release-definition');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'label.activate-release' })
      ).toBeEnabled()
    );
    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'label.activate-release' })
      )
    );

    expect(put).toHaveBeenCalledTimes(1);
    expect(showErrorToast).toHaveBeenCalledWith(conflict);
    expect(
      screen.queryByTestId('ontology-active-release')
    ).not.toBeInTheDocument();
  });

  it('keeps release reads available without publication permission', async () => {
    await renderPanel(false);
    await selectRelease();
    await screen.findByTestId('ontology-release-definition');

    expect(
      screen.getByRole('button', { name: 'label.capture-release' })
    ).toBeDisabled();
    expect(screen.getByTestId('ontology-request-review')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'label.activate-release' })
    ).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});
