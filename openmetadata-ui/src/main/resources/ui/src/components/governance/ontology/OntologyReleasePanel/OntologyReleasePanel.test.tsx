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
let currentOntology: Ontology;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
let downloadedBlob: Blob | undefined;
let downloadedFileName: string | undefined;
let anchorClick: jest.SpyInstance;

const renderPanel = async (
  canEdit = true,
  view: 'changes' | 'releases' = 'releases'
) => {
  await act(async () => {
    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleasePanel
          canEdit={canEdit}
          ontology={ontology}
          view={view}
        />
      </MemoryRouter>
    );
  });
};

const selectRelease = async () => {
  fireEvent.click(
    screen.getByRole('button', { name: 'label.ontology-release' })
  );
  fireEvent.click(await screen.findByTestId('tree-node-release-id'));
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
    currentOntology = { ...ontology };
    get.mockImplementation(async (url) => {
      if (url === '/ontologies/ontology-id') {
        return { data: currentOntology };
      }
      if (url.endsWith('/state')) {
        return { data: currentState };
      }
      if (url.endsWith('/diff')) {
        return { data: { data: [], paging: { total: 0 } } };
      }
      if (url.endsWith('/export')) {
        return { data: 'sealed release content' };
      }
      if (url === '/ontologyReleases/release-id') {
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
      if (url === '/ontologyReleases') {
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

    expect(
      await screen.findByRole('button', { name: 'label.ontology-release' })
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'label.capture-release' })
    ).not.toBeInTheDocument();
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
      expectedWorkingRevision: 7,
    });
    expect(put).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'label.activate-release' })
    ).toBeDisabled();
    expect(
      screen.getByText('message.ontology-consistency-not-run')
    ).toBeInTheDocument();
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

  it('does not activate an already active release again', async () => {
    currentState.activeReleaseId = release.id;
    currentRelease.entityStatus = EntityStatus.Approved;
    currentRelease.id = 'release-id';
    put.mockImplementation(async () => {
      currentState = { ...currentState, activationRevision: 4 };

      return { data: currentState };
    });
    await renderPanel();
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
    await screen.findByTestId('ontology-release-definition');
    fireEvent.click(
      screen.getByRole('button', { name: 'label.ontology-release' })
    );
    fireEvent.click(await screen.findByTestId('tree-node-release-id'));
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
    await screen.findByTestId('ontology-release-definition');
    fireEvent.click(
      screen.getByRole('button', { name: 'label.ontology-release' })
    );
    fireEvent.click(await screen.findByTestId('tree-node-release-id'));
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
