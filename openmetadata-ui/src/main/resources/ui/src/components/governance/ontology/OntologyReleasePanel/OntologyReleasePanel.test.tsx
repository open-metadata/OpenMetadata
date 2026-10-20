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
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  EncodingVersion,
  EntityStatus,
  LogicalCheck,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import { OntologyState } from '../../../../generated/type/ontologyState';
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
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const get = APIClient.get as jest.MockedFunction<typeof APIClient.get>;
const post = APIClient.post as jest.MockedFunction<typeof APIClient.post>;
const put = APIClient.put as jest.MockedFunction<typeof APIClient.put>;
const ontology: Ontology = {
  id: 'ontology-id',
  name: 'Sales',
  fullyQualifiedName: 'Sales',
  iri: 'urn:sales',
  namespace: 'urn:sales:',
};
const release: OntologyRelease = {
  id: 'release-id',
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
  fireEvent.click(
    await screen.findByTestId('ontology-release-select-release-id')
  );
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
    get.mockImplementation(async (url, config) => {
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
      if (url === `/ontologyReleases/${currentRelease.id}`) {
        return { data: currentRelease };
      }
      if (url === '/ontologyReleases/new-release-id') {
        return {
          data: {
            ...release,
            id: 'new-release-id',
            name: 'Release 2',
            releaseRevision: 2,
            entityStatus: EntityStatus.Approved,
          },
        };
      }
      if (url.endsWith('/structure')) {
        return {
          data: {
            releaseId: currentRelease.id,
            contentDigest: currentRelease.contentDigest,
            valid: true,
            violationCount: 0,
            violations: [],
          },
        };
      }
      if (url.endsWith('/events')) {
        return { data: { data: [], paging: { total: 0 } } };
      }
      if (url === '/ontologies/ontology-id/releases') {
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
    expect(
      screen.queryByRole('button', { name: 'label.capture-release' })
    ).not.toBeInTheDocument();
  });

  it('shows active release details only after selecting its history row', async () => {
    currentState.activeReleaseId = release.id;
    currentRelease.entityStatus = EntityStatus.Approved;
    await renderPanel();

    expect(
      await screen.findByTestId('ontology-release-select-release-id')
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
      screen.getByTestId('ontology-release-select-release-id')
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

      expect(get).toHaveBeenCalledWith('/ontologyReleases/release-id/export', {
        params: { format },
        headers: { Accept: mimeType },
        responseType: 'text',
      });
      expect(downloadedFileName).toBe(
        `ontology-release-release-id.${extension}`
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
      expect(downloadedFileName).toBe('ontology-release-release-id.ttl')
    );
  });

  it('captures the displayed working revision without approving or activating it', async () => {
    post.mockResolvedValue({ data: release });
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

    expect(post).toHaveBeenCalledWith('/ontologies/ontology-id/releases', {
      expectedActivationRevision: 3,
      expectedWorkingRevision: 7,
      expectedLatestReleaseRevision: 1,
      versionBump: 'minor',
      releaseNotes: '',
    });
    expect(put).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'label.activate-release' })
    ).toBeDisabled();
    expect(
      screen.getByText('message.ontology-consistency-not-run')
    ).toBeInTheDocument();
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

  it('reports only the captured structural result and leaves logical consistency unchecked', async () => {
    const requests = get.getMockImplementation();
    get.mockImplementation(async (url, config) => {
      if (url.endsWith('/structure')) {
        return {
          data: {
            releaseId: release.id,
            contentDigest: release.contentDigest,
            valid: false,
            violationCount: 2,
            violations: [],
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

    expect(screen.getAllByText(/label.not-checked/)).toHaveLength(2);
    expect(get.mock.calls.some(([url]) => url.endsWith('/structure'))).toBe(
      false
    );

    await act(async () =>
      fireEvent.click(screen.getByTestId('ontology-capture-release'))
    );

    expect(
      await screen.findByText(/label.structural-validation.*label.failed/)
    ).toBeVisible();
    expect(
      screen.getByText(/label.logical-consistency.*label.not-checked/)
    ).toBeVisible();
    expect(screen.queryByText(/label.passed/)).not.toBeInTheDocument();
  });

  it('does not submit review when the latest release fence rejects capture', async () => {
    const conflict = new AxiosError('Latest release changed', '409');
    post.mockRejectedValue(conflict);
    await renderPanel(true, 'changes');
    await act(async () =>
      fireEvent.click(screen.getByTestId('ontology-request-review'))
    );

    expect(showErrorToast).toHaveBeenCalledWith(conflict);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/ontologies/ontology-id/releases',
      expect.objectContaining({ expectedLatestReleaseRevision: 1 })
    );
    expect(put).not.toHaveBeenCalled();
  });

  it('blocks capture on a stale cursor and retries from the first page', async () => {
    nextWorkingPage = 'next-page';
    post.mockResolvedValue({ data: release });
    nextPageError = Object.assign(new AxiosError('Stale cursor'), {
      response: { status: 412 },
    });
    await renderPanel(true, 'changes');

    expect(await screen.findByText(/Customer/)).toBeVisible();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'label.capture-release' })
      );
    });

    expect(
      await screen.findByRole('button', { name: 'label.request-approval' })
    ).toBeEnabled();

    fireEvent.click(screen.getByTestId('ontology-working-next'));

    expect(
      await screen.findByText('message.ontology-review-unavailable')
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'label.capture-release' })
    ).toBeDisabled();
    expect(
      await screen.findByRole('button', { name: 'label.request-approval' })
    ).toBeEnabled();
    expect(screen.queryByText(/Account/)).not.toBeInTheDocument();

    nextPageError = undefined;
    fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));

    expect(await screen.findByText(/Customer/)).toBeVisible();
    expect(screen.getByTestId('ontology-working-previous')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'label.capture-release' })
    ).toBeEnabled();
  });

  it('resets pagination when the first-page revision changes', async () => {
    nextWorkingPage = 'next-page';
    const { queryClient } = await renderPanel(true, 'changes');

    expect(await screen.findByText(/Customer/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'label.next' }));

    expect(await screen.findByText(/Account/)).toBeVisible();

    currentState = { ...currentState, workingRevision: 8 };
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ['ontology-working-diff', ontology.id, undefined],
      });
    });

    expect(await screen.findByText(/Customer/)).toBeVisible();
    expect(screen.queryByText(/Account/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.previous' })
    ).toBeDisabled();
  });

  it('blocks capture if the paged result does not match its first-page revision', async () => {
    nextWorkingPage = 'next-page';
    nextPageState = { ...initialState, workingRevision: 8 };
    await renderPanel(true, 'changes');

    expect(await screen.findByText(/Customer/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'label.next' }));

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
        id: 'approval-task',
        category: 'Approval',
        type: 'RequestApproval',
        name: 'Review release',
        status: 'Open',
      },
    });
    await renderPanel();
    await selectRelease();
    const request = await screen.findByRole('button', {
      name: 'label.request-approval',
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
    'retains one captured candidate across modal tabs and reconciles a lost task response: %s',
    async (taskWasCreated) => {
      let taskAttempts = 0;
      post.mockImplementation(async (url) => {
        if (url === '/ontologies/ontology-id/releases') {
          currentRelease = {
            ...release,
            id: 'captured-id',
            semanticVersion: '1.2.4',
            releaseRevision: 2,
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
                reviewTask: 'existing-task',
              };
            }

            throw new AxiosError('Task response unavailable', '503');
          }

          return {
            data: {
              id: 'new-task',
              category: 'Approval',
              type: 'RequestApproval',
              name: 'Review release',
              status: 'Open',
            },
          };
        }

        throw new Error(`Unexpected write: ${url}`);
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

      await act(async () =>
        fireEvent.click(
          screen.getByRole('button', { name: 'label.request-review' })
        )
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'label.retry-review' })
        ).toBeEnabled()
      );
      await act(async () =>
        fireEvent.click(screen.getByTestId('ontology-publication-tab-releases'))
      );
      await screen.findByTestId('ontology-release-select-captured-id');
      await act(async () =>
        fireEvent.click(screen.getByTestId('ontology-publication-tab-changes'))
      );

      expect(
        screen.getByRole('textbox', { name: /label.release-notes/ })
      ).toHaveValue('Fix customer aliases');
      expect(screen.getByTestId('ontology-version-preview')).toHaveTextContent(
        '1.2.3 → 1.2.4'
      );
      expect(
        screen.getByRole('button', { name: 'label.capture-release' })
      ).toBeDisabled();

      await act(async () =>
        fireEvent.click(
          screen.getByRole('button', { name: 'label.retry-review' })
        )
      );

      expect(
        post.mock.calls.filter(
          ([url]) => url === '/ontologies/ontology-id/releases'
        )
      ).toEqual([
        [
          '/ontologies/ontology-id/releases',
          {
            expectedActivationRevision: 3,
            expectedWorkingRevision: 7,
            expectedLatestReleaseRevision: 1,
            versionBump: 'patch',
            releaseNotes: 'Fix customer aliases',
          },
        ],
      ]);
      expect(taskAttempts).toBe(taskWasCreated ? 1 : 2);
      expect(get).toHaveBeenCalledWith('/ontologyReleases/captured-id', {
        signal: undefined,
      });
      expect(put).not.toHaveBeenCalled();
    }
  );

  it('loads newest-first owner history with numeric cursors and release events', async () => {
    const originalGet = get.getMockImplementation();
    get.mockImplementation(async (url, config) => {
      if (url === '/ontologies/ontology-id/releases') {
        const after = (config?.params as { after?: string })?.after;
        const older = {
          ...release,
          id: 'older-id',
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
      await screen.findByTestId('ontology-release-select-older-id')
    ).toBeVisible();
    expect(get).toHaveBeenCalledWith(
      '/ontologies/ontology-id/releases',
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

  it.each([undefined, 'new-release-id'])(
    'refreshes activation actor and time in the mounted release panel from %s',
    async (activeReleaseId) => {
      currentState.activeReleaseId = activeReleaseId;
      currentRelease.entityStatus = EntityStatus.Approved;
      let activated = false;
      const originalGet = get.getMockImplementation();
      get.mockImplementation(async (url, config) => {
        if (url.endsWith('/events')) {
          const data =
            url === '/ontologyReleases/release-id/events'
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

  it('does not activate an already active release again', async () => {
    currentState.activeReleaseId = release.id;
    currentRelease.entityStatus = EntityStatus.Approved;
    currentRelease.id = 'release-id';
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
      reviewTask: 'rejected-task',
    };
    await renderPanel();
    await selectRelease();

    expect(
      await screen.findByRole('link', { name: 'label.approval' })
    ).toHaveAttribute('href', '/tasks/rejected-task');
    expect(
      screen.queryByRole('button', { name: 'label.request-approval' })
    ).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('links to the pending workflow without allowing a second submission', async () => {
    currentRelease = {
      ...release,
      entityStatus: EntityStatus.InReview,
      reviewTask: 'pending-task',
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
    currentState.activeReleaseId = 'new-release-id';
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

    expect(put).toHaveBeenCalledWith('/ontologies/ontology-id/activation', {
      releaseId: 'release-id',
      expectedActivationRevision: 3,
    });
    expect(
      await screen.findByTestId('ontology-active-release')
    ).toBeInTheDocument();
  });

  it('keeps the active pointer unchanged when the server rejects a stale activation', async () => {
    currentState.activeReleaseId = 'new-release-id';
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
      screen.queryByRole('button', { name: 'label.capture-release' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.request-approval' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'label.activate-release' })
    ).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});
