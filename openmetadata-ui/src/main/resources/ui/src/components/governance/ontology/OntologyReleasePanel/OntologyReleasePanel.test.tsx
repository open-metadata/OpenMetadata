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
  within,
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
import { useIsAiMode } from '../../../../hooks/useAppMode';
import enUS from '../../../../locale/languages/en-us.json';
import APIClient from '../../../../rest/axiosClient';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../../test/unit/enUsTranslation';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import { formatDateTimeLong } from '../../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyPublicationModal from '../OntologyPublicationModal/OntologyPublicationModal';
import OntologyReleasePanel from './OntologyReleasePanel';

const activationButton = () =>
  screen.queryByTestId('ontology-rollback-release') ??
  screen.getByRole('button', { name: 'label.activate-release' });
const clickActivation = async () => {
  const button = activationButton();
  const isRollback = button.dataset.testid === 'ontology-rollback-release';
  await act(async () => {
    fireEvent.click(button);
  });
  if (isRollback && !button.hasAttribute('disabled')) {
    const confirm = await screen.findByTestId('ontology-rollback-confirm');
    await act(async () => {
      fireEvent.click(confirm);
    });
  }
};

jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));
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
  baseReleaseId: '00000000-0000-4000-8000-000000000009',
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
const baseRelease: OntologyRelease = {
  ...release,
  id: '00000000-0000-4000-8000-000000000009',
  name: 'Release 0',
  releaseRevision: 0,
  semanticVersion: '1.2.3',
  baseReleaseId: undefined,
  entityStatus: EntityStatus.Approved,
};
const initialState: OntologyState = {
  ontologyId: ontology.id,
  activationRevision: 3,
  workingRevision: 7,
  lastReleaseRevision: 1,
  activeReleaseId: baseRelease.id,
};
let currentState: OntologyState;
let currentRelease: OntologyRelease;
let groupedWorking = false;
let workingValidation: { valid: boolean; violations: unknown[] } = {
  valid: true,
  violations: [],
};
let groupedPropertyCount = 3;
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
      groups: groupedWorking
        ? [
            {
              concept: 'Funds Transfer',
              iri: 'https://example.org/fin#FundsTransfer',
              parents: ['Payment', 'Transaction'],
              propertyCount: groupedPropertyCount,
              changes: [
                {
                  changeType: 'ADDED',
                  entity: {
                    id: 'funds-transfer-id',
                    name: 'FundsTransfer',
                    type: 'ontologyConcept',
                  },
                  memberKind: 'CONCEPT',
                  ontologyId: ontology.id,
                },
              ],
              changeType: 'ADDED',
            },
          ]
        : undefined,
      data: groupedWorking
        ? []
        : [
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
    (useIsAiMode as jest.Mock).mockReturnValue(false);
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
    groupedWorking = false;
    workingValidation = { valid: true, violations: [] };
    groupedPropertyCount = 3;
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
      if (url === `/ontologyReleases/${baseRelease.id}`) {
        return { data: baseRelease };
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
      if (url.endsWith('/validation') && !url.includes('/working/')) {
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
      if (url.endsWith('/working/validation')) {
        return { data: workingValidation };
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
    useKeyEchoTranslations();
  });

  it('separates working changes from release history for the publication modal', async () => {
    await renderPanel(true, 'changes');

    expect(
      await screen.findByRole('button', { name: 'label.save-as-release-draft' })
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
    expect(screen.getByTestId('ontology-change-counts')).toHaveTextContent(
      'message.ontology-change-total: message.native-concept-count'
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'label.save-as-release-draft' })
      ).toBeEnabled()
    );
    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'label.save-as-release-draft' })
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
    expect(activationButton()).toBeDisabled();
    expect(
      screen.getByText('message.ontology-consistency-not-run')
    ).toBeInTheDocument();
  });

  it('holds Activate and asks for a status check when the server sealed another version than the one requested', async () => {
    post.mockImplementation(async () => {
      currentRelease = {
        ...release,
        id: '00000000-0000-4000-8000-000000000007',
        releaseRevision: 2,
        semanticVersion: '1.3.1',
        entityStatus: EntityStatus.Approved,
      };
      currentState = { ...currentState, lastReleaseRevision: 2 };

      return { data: currentRelease };
    });
    await renderPanel(true, 'changes');
    await screen.findByText(/Customer/);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'label.save-as-release-draft' })
      ).toBeEnabled()
    );
    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'label.save-as-release-draft' })
      )
    );

    expect(await screen.findByTestId('ontology-recovery-action')).toBeVisible();
    expect(
      screen.getByText('message.ontology-publication-recovery')
    ).toBeVisible();
    expect(activationButton()).toBeDisabled();
    expect(put).not.toHaveBeenCalled();
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
        semanticVersion: '1.3.0',
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

    await waitFor(() =>
      expect(
        within(screen.getByTestId('ontology-release-definition')).getByRole(
          'heading',
          { name: 'v1.3.0' }
        )
      ).toBeVisible()
    );

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
    expect(
      await screen.findByTestId(`ontology-release-export-${captures[1].id}`)
    ).toBeVisible();
    expect(
      screen.queryByTestId(`ontology-release-export-${captures[0].id}`)
    ).not.toBeInTheDocument();
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
    await waitFor(() => expect(activationButton()).toBeEnabled());
    put.mockImplementation(async () => {
      currentState = {
        ...currentState,
        activeReleaseId: captures[1].id,
        activationRevision: 4,
      };

      return { data: currentState };
    });
    await clickActivation();

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
    expect(screen.getByTestId('ontology-change-counts')).toHaveTextContent(
      'message.ontology-change-total'
    );
    expect(screen.queryByText(/Customer/)).not.toBeInTheDocument();
  });

  it('reports the captured structural result and leaves logical consistency unchecked', async () => {
    const requests = get.getMockImplementation();
    get.mockImplementation(async (url, config) => {
      if (url.endsWith('/validation') && !url.includes('/working/')) {
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
    expect(screen.getByTestId('ontology-request-review')).toBeDisabled();

    fireEvent.click(
      within(screen.getByTestId('ontology-version-major')).getByRole('radio')
    );

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
      screen.getByRole('button', { name: 'label.save-as-release-draft' })
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
        'v1.2.3 → v1.2.4'
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('ontology-request-review'));
      });

      expect(
        await screen.findByTestId(
          taskWasCreated
            ? 'ontology-publish-release'
            : 'ontology-request-review'
        )
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
        'label.ontology-in-review'
      );
      expect(screen.getByRole('link', { name: 'TASK-00042' })).toHaveAttribute(
        'href',
        '/tasks/' + currentRelease.reviewTask
      );
      expect(put).not.toHaveBeenCalled();
    }
  );

  it('ships the Open task label the button renders', () => {
    expect(enUS.label['open-task']).toBe('Open task');
  });

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
      await screen.findByRole('button', { name: /^label\.open-task · / })
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
          entityStatus: EntityStatus.Approved,
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
      await clickActivation();

      expect(
        (await screen.findByText(/activation-author/)).closest(
          '[data-testid="ontology-release-event"]'
        )
      ).toHaveTextContent(formatDateTimeLong(2000));
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

      await clickActivation();
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
      screen.queryByRole('button', { name: 'label.activate-release' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-rollback-release')
    ).not.toBeInTheDocument();
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
    expect(activationButton()).toBeDisabled();
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
    await waitFor(() => expect(activationButton()).toBeEnabled());
    await clickActivation();

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

    expect(activationButton()).toBeEnabled();

    await clickActivation();

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

    expect(activationButton()).toBeEnabled();

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

    expect(activationButton()).toBeDisabled();

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
    expect(activationButton()).toBeDisabled();

    await clickActivation();

    expect(put).not.toHaveBeenCalled();

    get.mockImplementation(requests);
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'label.retry' }))
    );

    expect(
      screen.queryByText('message.ontology-review-unavailable')
    ).not.toBeInTheDocument();
    expect(activationButton()).toBeEnabled();
  });

  it('keeps the active pointer unchanged when the server rejects a stale activation', async () => {
    currentState.activeReleaseId = '00000000-0000-4000-8000-000000000006';
    currentRelease.entityStatus = EntityStatus.Approved;
    const conflict = new AxiosError('Activation revision changed', '409');
    put.mockRejectedValue(conflict);
    await renderPanel();
    await selectRelease();
    await screen.findByTestId('ontology-release-definition');
    await waitFor(() => expect(activationButton()).toBeEnabled());
    await clickActivation();

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

    expect(screen.queryByTestId('ontology-capture-release')).toBeNull();
    expect(screen.queryByTestId('ontology-request-review')).toBeNull();
    expect(activationButton()).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('renders one server-grouped class change row instead of individual definition rows', async () => {
    useEnUsTranslations();
    groupedWorking = true;
    await renderPanel(true, 'changes');

    const summary = await screen.findByTestId(
      'ontology-working-concept-summary'
    );

    expect(summary.textContent).toBe(
      'Class Funds Transfer ⊑ Payment, Transaction · 3 properties'
    );
    expect(
      screen.getAllByTestId('ontology-working-concept-group')
    ).toHaveLength(1);
    expect(screen.getByTestId('ontology-change-counts')).toHaveTextContent(
      /^1 change: 1 concept$/
    );
    expect(screen.queryByText('Concept')).not.toBeInTheDocument();
  });

  it('reads a single property in the singular', async () => {
    useEnUsTranslations();
    groupedWorking = true;
    groupedPropertyCount = 1;
    await renderPanel(true, 'changes');

    const summary = await screen.findByTestId(
      'ontology-working-concept-summary'
    );

    expect(summary.textContent).toBe(
      'Class Funds Transfer ⊑ Payment, Transaction · 1 property'
    );
  });

  it('groups an ungrouped working diff and captures with the chosen version in AI mode', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    post.mockResolvedValue({ data: release });
    await renderPanel(true, 'changes');

    const groups = await screen.findByTestId('ontology-change-groups');

    expect(groups).toHaveTextContent('label.concept-plural');
    expect(groups).toHaveTextContent('Customer');
    expect(groups).toHaveTextContent('label.added');

    fireEvent.click(
      await screen.findByRole('radio', { name: /label.version-patch/ })
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: /label.release-notes/ }),
      { target: { value: 'Patch notes' } }
    );

    expect(screen.getByTestId('ontology-version-preview')).toHaveTextContent(
      'v1.2.3 → v1.2.4'
    );
    expect(screen.getByTestId('ontology-request-review')).toBeEnabled();

    await waitFor(() =>
      expect(screen.getByTestId('ontology-capture-release')).toBeEnabled()
    );
    await act(async () =>
      fireEvent.click(screen.getByTestId('ontology-capture-release'))
    );

    expect(post).toHaveBeenCalledWith(`/ontologies/${ontology.id}/releases`, {
      expectedActivationRevision: 3,
      expectedWorkingRevision: 7,
      expectedLatestReleaseRevision: 1,
      versionBump: 'patch',
      releaseNotes: 'Patch notes',
    });
  });

  it('shows a deprecated change from an ungrouped working diff with its badge in AI mode', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    const defaultGet = get.getMockImplementation();
    get.mockImplementation(async (url, config) =>
      url.endsWith('/working/diff')
        ? {
            data: {
              state: currentState,
              data: [
                {
                  changeType: 'DEPRECATED',
                  entity: {
                    id: 'legacy-customer-id',
                    name: 'LegacyCustomer',
                    type: 'ontologyConcept',
                  },
                  memberKind: 'CONCEPT',
                  ontologyId: ontology.id,
                },
              ],
              paging: { total: 1 },
            },
          }
        : defaultGet?.(url, config)
    );
    await renderPanel(true, 'changes');

    const row = (await screen.findByText('LegacyCustomer')).closest('li');

    expect(row).toHaveTextContent('label.deprecated');
  });

  it('shows the server-grouped class change row in the AI Changes view', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    useEnUsTranslations();
    groupedWorking = true;
    await renderPanel(true, 'changes');

    const summary = await screen.findByTestId(
      'ontology-working-concept-summary'
    );

    expect(summary.textContent).toBe(
      'Class Funds Transfer ⊑ Payment, Transaction · 3 properties'
    );
    expect(
      screen.getAllByTestId('ontology-working-concept-group')
    ).toHaveLength(1);
    expect(screen.getByTestId('ontology-change-counts')).toHaveTextContent(
      /^1 change: 1 concept$/
    );
  });

  it('counts the same changes in the AI footer as in the summary, with one row per changed class', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    useEnUsTranslations();
    const defaultGet = get.getMockImplementation();
    get.mockImplementation(async (url, config) =>
      url.endsWith('/working/diff')
        ? {
            data: {
              state: currentState,
              data: [],
              groups: [
                {
                  concept: 'Funds Transfer',
                  iri: 'https://example.org/fin#FundsTransfer',
                  parents: ['Payment', 'Transaction'],
                  propertyCount: 3,
                  changeType: 'ADDED',
                  changes: [
                    {
                      changeType: 'ADDED',
                      entity: {
                        id: 'funds-transfer-id',
                        name: 'FundsTransfer',
                        type: 'ontologyConcept',
                      },
                      memberKind: 'CONCEPT',
                      ontologyId: ontology.id,
                    },
                    {
                      changeType: 'ADDED',
                      entity: {
                        id: 'payment-axiom-id',
                        name: 'FundsTransfer subClassOf Payment',
                        type: 'ontologyAxiom',
                      },
                      memberKind: 'AXIOM',
                      ontologyId: ontology.id,
                    },
                    {
                      changeType: 'ADDED',
                      entity: {
                        id: 'transaction-axiom-id',
                        name: 'FundsTransfer subClassOf Transaction',
                        type: 'ontologyAxiom',
                      },
                      memberKind: 'AXIOM',
                      ontologyId: ontology.id,
                    },
                    {
                      changeType: 'ADDED',
                      entity: {
                        id: 'amount-id',
                        name: 'amount',
                        type: 'ontologyProperty',
                      },
                      memberKind: 'PROPERTY',
                      ontologyId: ontology.id,
                    },
                    {
                      changeType: 'ADDED',
                      entity: {
                        id: 'currency-id',
                        name: 'currency',
                        type: 'ontologyProperty',
                      },
                      memberKind: 'PROPERTY',
                      ontologyId: ontology.id,
                    },
                    {
                      changeType: 'ADDED',
                      entity: {
                        id: 'value-date-id',
                        name: 'valueDate',
                        type: 'ontologyProperty',
                      },
                      memberKind: 'PROPERTY',
                      ontologyId: ontology.id,
                    },
                  ],
                },
                {
                  changeType: 'CHANGED',
                  parents: [],
                  propertyCount: 0,
                  changes: [
                    {
                      changeType: 'CHANGED',
                      entity: {
                        id: 'payment-shape-id',
                        name: 'PaymentShape',
                        type: 'ontologyShape',
                      },
                      memberKind: 'SHAPE',
                      ontologyId: ontology.id,
                    },
                  ],
                },
              ],
              paging: { total: 2 },
            },
          }
        : defaultGet?.(url, config)
    );
    await renderPanel(true, 'changes');

    expect(
      await screen.findByTestId('ontology-change-counts')
    ).toHaveTextContent(/^7 changes: 1 concept, 3 properties, 3 rules$/);
    expect(
      screen.getAllByTestId('ontology-working-concept-group')
    ).toHaveLength(2);

    const preview = await screen.findByTestId('ontology-version-preview');

    await waitFor(() => expect(preview).toHaveTextContent('v1.2.3 → v1.3.0'));

    expect(preview.parentElement?.textContent).toBe(
      'v1.2.3 → v1.3.0 · 7 changes'
    );
  });

  it('keeps release rows, export and the release detail actions in AI mode', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    currentState.activeReleaseId = release.id;
    currentRelease.entityStatus = EntityStatus.Approved;
    await renderPanel();
    await selectRelease();

    expect(
      await screen.findByTestId('ontology-release-definition')
    ).toBeVisible();
    expect(screen.getByTestId('ontology-active-release')).toBeVisible();
    expect(
      screen.getByTestId(`ontology-release-export-${release.id}`)
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', { name: 'label.activate-release' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-rollback-release')
    ).not.toBeInTheDocument();
    expect(screen.getByText('label.release-events')).toBeVisible();
  });

  it('publishes an approved release from the AI footer', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    currentRelease.entityStatus = EntityStatus.Approved;
    put.mockResolvedValue({
      data: { ...currentState, activeReleaseId: release.id },
    });
    await renderPanel(true, 'changes');

    const publish = await screen.findByTestId('ontology-publish-release');

    expect(publish).toHaveTextContent('label.publish v1.2.3');
    expect(
      screen.queryByTestId('ontology-request-review')
    ).not.toBeInTheDocument();

    await waitFor(() => expect(publish).toBeEnabled());
    await act(async () => fireEvent.click(publish));

    expect(put.mock.calls.map(([, body]) => body)).toEqual([
      { releaseId: release.id, expectedActivationRevision: 3 },
    ]);
  });

  it('labels the latest release, not the first history row, in AI mode', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    const older = {
      ...release,
      id: '00000000-0000-4000-8000-000000000004',
      releaseRevision: 0,
      semanticVersion: '1.0.0',
      entityStatus: EntityStatus.Approved,
    };
    const defaultGet = get.getMockImplementation();
    get.mockImplementation(async (url, config) =>
      url === `/ontologies/${ontology.id}/releases`
        ? { data: { data: [older, currentRelease], paging: { total: 2 } } }
        : defaultGet?.(url, config)
    );
    await renderPanel();

    const latestRow = (
      await screen.findByTestId(`ontology-release-select-${release.id}`)
    ).closest('li');
    const olderRow = screen
      .getByTestId(`ontology-release-select-${older.id}`)
      .closest('li');

    expect(latestRow).toHaveTextContent('label.latest');
    expect(olderRow).not.toHaveTextContent('label.latest');
  });

  it('hides superseded drafts without a review task from the Releases tab', async () => {
    const supersededDraft = {
      ...release,
      id: '00000000-0000-4000-8000-000000000004',
      releaseRevision: 0,
      semanticVersion: '0.1.0',
    };
    const defaultGet = get.getMockImplementation();
    get.mockImplementation(async (url, config) =>
      url === `/ontologies/${ontology.id}/releases`
        ? {
            data: {
              data: [currentRelease, supersededDraft],
              paging: { total: 2 },
            },
          }
        : defaultGet?.(url, config)
    );
    await renderPanel();

    expect(
      await screen.findByTestId(`ontology-release-select-${release.id}`)
    ).toBeVisible();
    expect(
      screen.queryByTestId(`ontology-release-select-${supersededDraft.id}`)
    ).not.toBeInTheDocument();
  });

  it('offers the review retry in AI mode after the task request fails', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    let taskAttempts = 0;
    post.mockImplementation(async (url) => {
      if (url === `/ontologies/${ontology.id}/releases`) {
        currentRelease = {
          ...release,
          id: '00000000-0000-4000-8000-000000000007',
          semanticVersion: '1.3.0',
          releaseRevision: 2,
        };
        currentState = { ...currentState, lastReleaseRevision: 2 };

        return { data: currentRelease };
      }
      if (url === '/tasks') {
        taskAttempts++;
        if (taskAttempts === 1) {
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
    await renderPanel(true, 'changes');
    await waitFor(() =>
      expect(screen.getByTestId('ontology-request-review')).toBeEnabled()
    );
    await act(async () =>
      fireEvent.click(screen.getByTestId('ontology-request-review'))
    );

    const retry = await screen.findByTestId('ontology-recovery-action');

    expect(retry).toHaveTextContent('label.retry-review');

    await act(async () => fireEvent.click(retry));

    expect(taskAttempts).toBe(2);
    expect(
      screen.queryByTestId('ontology-recovery-action')
    ).not.toBeInTheDocument();
  });

  const failFirstReviewRead = () => {
    const defaultGet = get.getMockImplementation();
    let reviewReads = 0;
    get.mockImplementation(async (url, config) => {
      if (url.endsWith('/review') && ++reviewReads === 1) {
        throw new Error('Review read failed');
      }

      return defaultGet?.(url, config);
    });
  };

  it('offers the review state retry in the AI Changes view', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    currentRelease.entityStatus = EntityStatus.InReview;
    currentRelease.reviewTask = '00000000-0000-4000-8000-000000000044';
    failFirstReviewRead();
    await renderPanel(true, 'changes');

    const retry = await screen.findByRole('button', { name: 'label.retry' });

    expect(
      screen.queryByTestId('ontology-publish-release')
    ).not.toBeInTheDocument();

    await act(async () => fireEvent.click(retry));

    expect(
      await screen.findByTestId('ontology-publish-release')
    ).toHaveTextContent('label.publish v1.2.3');
  });

  it('offers the review state retry in the AI Releases view', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    currentRelease.entityStatus = EntityStatus.Approved;
    currentRelease.reviewTask = '00000000-0000-4000-8000-000000000044';
    failFirstReviewRead();
    await renderPanel(true, 'releases');
    await selectRelease();

    const retry = await screen.findByRole('button', { name: 'label.retry' });

    expect(activationButton()).toBeDisabled();

    await act(async () => fireEvent.click(retry));

    await waitFor(() => expect(activationButton()).toBeEnabled());
  });

  it('shows one review-unavailable alert in AI mode when the state read fails', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    const defaultGet = get.getMockImplementation();
    get.mockImplementation(async (url, config) => {
      if (url.endsWith('/state')) {
        throw new AxiosError('State unavailable', '403');
      }

      return defaultGet?.(url, config);
    });
    await renderPanel(true, 'changes');
    await screen.findAllByText('message.ontology-review-unavailable');
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getAllByText('message.ontology-review-unavailable')
    ).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'label.retry' })).toHaveLength(
      1
    );
  });

  it('shows the storage-unavailable alert in AI mode', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('Storage unavailable');
      });
    try {
      await renderPanel(true, 'changes');

      expect(
        await screen.findByText(
          'message.ontology-publication-storage-unavailable'
        )
      ).toBeVisible();

      await waitFor(() =>
        expect(screen.getByTestId('ontology-request-review')).toBeDisabled()
      );
    } finally {
      setItem.mockRestore();
    }
  });
});

describe('reviewing what changed (G7)', () => {
  const memberOf = (memberKind: string, changeType: string, name: string) => ({
    memberKind,
    changeType,
    ontologyId: ontology.id,
    entity: { id: name + '-id', name, type: 'ontologyConcept' },
  });
  const groupOf = (
    concept: string,
    changeType: string,
    members: ReturnType<typeof memberOf>[],
    iri = 'urn:uuid:0c74f640-1111-4222-8333-444455556666'
  ) => ({
    concept,
    iri,
    changeType,
    parents: [],
    propertyCount: 0,
    changes: members,
  });
  const serveGroups = (
    groups: ReturnType<typeof groupOf>[],
    paging: { total: number; after?: string } = { total: groups.length }
  ) => {
    const defaultGet = get.getMockImplementation();
    get.mockImplementation(async (url, config) =>
      url.endsWith('/working/diff')
        ? {
            data: {
              state: currentState,
              data: [],
              groups,
              paging,
            },
          }
        : defaultGet?.(url, config)
    );
  };
  const rows = () =>
    screen
      .queryAllByTestId('ontology-working-concept-summary')
      .map((row) => row.textContent);

  beforeEach(() => {
    useEnUsTranslations();
  });

  it('names a server-minted concept by its label, never by its UUID IRI', async () => {
    serveGroups([
      groupOf('Customer Account', 'ADDED', [
        memberOf('CONCEPT', 'ADDED', 'Customer Account'),
      ]),
    ]);
    await renderPanel(true, 'changes');

    expect(
      (await screen.findByTestId('ontology-working-concept-summary'))
        .textContent
    ).toBe('Class Customer Account · 0 properties');
    expect(screen.queryByText(/0c74f640/)).not.toBeInTheDocument();
  });

  it('counts changes per kind and leaves the ontology row out', async () => {
    serveGroups([
      groupOf('Alpha', 'ADDED', [
        memberOf('ONTOLOGY', 'CHANGED', 'Sales'),
        memberOf('CONCEPT', 'ADDED', 'Alpha'),
        memberOf('PROPERTY', 'ADDED', 'alphaCode'),
      ]),
    ]);
    await renderPanel(true, 'changes');

    expect(
      await screen.findByTestId('ontology-change-counts')
    ).toHaveTextContent(/^2 changes: 1 concept, 1 property$/);
  });

  it('filters by kind of change and searches, with counts on each filter', async () => {
    serveGroups([
      groupOf('Alpha', 'ADDED', [memberOf('CONCEPT', 'ADDED', 'Alpha')]),
      groupOf('Alpine', 'ADDED', [memberOf('CONCEPT', 'ADDED', 'Alpine')]),
      groupOf('Beta', 'CHANGED', [memberOf('CONCEPT', 'CHANGED', 'Beta')]),
      groupOf('Gamma', 'REMOVED', [memberOf('CONCEPT', 'REMOVED', 'Gamma')]),
    ]);
    await renderPanel(true, 'changes');
    await screen.findByTestId('ontology-change-counts');

    expect(screen.getByTestId('ontology-change-filter-all')).toHaveTextContent(
      'All · 4'
    );
    expect(
      screen.getByTestId('ontology-change-filter-added')
    ).toHaveTextContent('Added · 2');

    fireEvent.click(screen.getByTestId('ontology-change-filter-removed'));

    expect(rows()).toEqual(['Class Gamma · 0 properties']);

    fireEvent.click(screen.getByTestId('ontology-change-filter-all'));
    fireEvent.change(screen.getByTestId('ontology-change-search'), {
      target: { value: 'alp' },
    });

    expect(rows()).toEqual([
      'Class Alpha · 0 properties',
      'Class Alpine · 0 properties',
    ]);
    expect(screen.getByTestId('ontology-change-filter-all')).toHaveTextContent(
      'All · 2'
    );
  });

  it('pre-selects Major with its reason when a definition was removed', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    serveGroups([
      groupOf('Gamma', 'REMOVED', [memberOf('CONCEPT', 'REMOVED', 'Gamma')]),
    ]);
    await renderPanel(true, 'changes');

    expect(await screen.findByRole('radio', { name: /Major/ })).toBeChecked();
    expect(screen.getByTestId('ontology-version-reason')).toHaveTextContent(
      'You removed definitions that readers may rely on, so a Major version is suggested.'
    );
    expect(screen.getByTestId('ontology-version-preview')).toHaveTextContent(
      'v1.2.3 → v2.0.0'
    );
  });

  it('suggests Minor for additions only', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    serveGroups([
      groupOf('Alpha', 'ADDED', [memberOf('CONCEPT', 'ADDED', 'Alpha')]),
    ]);
    await renderPanel(true, 'changes');

    expect(await screen.findByRole('radio', { name: /Minor/ })).toBeChecked();
    expect(screen.getByTestId('ontology-version-reason')).toHaveTextContent(
      'a Minor version is suggested'
    );
  });

  it('shows the working draft check before any capture', async () => {
    workingValidation = {
      valid: false,
      violations: [
        {
          code: 'SUBCLASS_CYCLE',
          message: 'Customer is its own ancestor',
          path: '/Customer',
          severity: 'ERROR',
        },
      ],
    };
    serveGroups([
      groupOf('Customer', 'ADDED', [memberOf('CONCEPT', 'ADDED', 'Customer')]),
    ]);
    currentRelease.sourceWorkingRevision = 1;
    await renderPanel(true, 'changes');

    expect(
      await screen.findByTestId('ontology-working-violations')
    ).toHaveTextContent('Customer is its own ancestor');
  });

  it('tells the reader the counts cover only the first page when the diff has a next page', async () => {
    serveGroups(
      [groupOf('Alpha', 'ADDED', [memberOf('CONCEPT', 'ADDED', 'Alpha')])],
      { total: 1400, after: 'page-two' }
    );
    await renderPanel(true, 'changes');

    expect(
      await screen.findByTestId('ontology-changes-truncated')
    ).toHaveTextContent(
      'Only the first change is counted. The filter counts and per-kind counts may be incomplete, so no version is suggested.'
    );
  });

  it('suggests no version and asks for a choice when the diff has a next page, because a removal there would be missed', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    serveGroups(
      [groupOf('Alpha', 'ADDED', [memberOf('CONCEPT', 'ADDED', 'Alpha')])],
      { total: 1400, after: 'page-two' }
    );
    await renderPanel(true, 'changes');

    expect(
      await screen.findByTestId('ontology-version-pick-required')
    ).toHaveTextContent('Choose the version yourself before you publish.');
    expect(
      screen.queryByTestId('ontology-version-reason')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Minor/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Major/ })).not.toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: /Major/ }));

    expect(screen.getByRole('radio', { name: /Major/ })).toBeChecked();
    expect(
      screen.queryByTestId('ontology-version-pick-required')
    ).not.toBeInTheDocument();
  });

  it('shows no truncation note when the whole diff fits in one page', async () => {
    serveGroups([
      groupOf('Alpha', 'ADDED', [memberOf('CONCEPT', 'ADDED', 'Alpha')]),
    ]);
    await renderPanel(true, 'changes');
    await screen.findByTestId('ontology-change-counts');

    expect(
      screen.queryByTestId('ontology-changes-truncated')
    ).not.toBeInTheDocument();
  });
});
