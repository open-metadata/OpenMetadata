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
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Ontology } from '../../generated/entity/data/ontology';
import {
  EncodingVersion,
  EntityStatus,
  LogicalCheck,
  OntologyRelease,
} from '../../generated/entity/data/ontologyRelease';
import { Stage } from '../../generated/type/ontologyPublicationStatus';
import { OntologyState } from '../../generated/type/ontologyState';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import APIClient from '../../rest/axiosClient';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../test/unit/test-utils';
import OntologyExplorerPage from './OntologyExplorerPage';

jest.mock('../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true, isFirstTimeUser: false }),
}));
jest.mock(
  '../../components/OntologyExplorer/hooks/useOntologyAiCapability',
  () => ({
    useOntologyAiCapability: () => ({
      isEnabled: false,
      isRdfEnabled: true,
      isLoading: false,
    }),
  })
);
jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));
jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: () => ({ canEditAll: true, hasViewAccess: true }),
}));
jest.mock('../../components/common/DocumentTitle/DocumentTitle', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../components/OntologyExplorer/OntologyGraphG6', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@uiw/react-codemirror', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../utils/ToastUtils', () => ({ showErrorToast: jest.fn() }));
jest.mock('../../rest/axiosClient', () => ({
  get: jest.fn(),
  put: jest.fn(),
  post: jest.fn(),
}));

runQueryNotificationsSynchronously();
const get = APIClient.get as jest.MockedFunction<typeof APIClient.get>;
const put = APIClient.put as jest.MockedFunction<typeof APIClient.put>;
const id = (n: number) =>
  '00000000-0000-4000-8000-' + String(n).padStart(12, '0');

it('publishes the captured version and refreshes the live header, working count and history active pointer', async () => {
  sessionStorage.clear();
  useApplicationStore.setState({
    currentUser: { id: id(2), name: 'editor', email: 'editor@example.com' },
  });
  const release: OntologyRelease = {
    id: id(5),
    name: 'release-5',
    fullyQualifiedName: 'Sales.release-5',
    ontology: { id: id(1), type: 'ontology' },
    releaseRevision: 5,
    semanticVersion: '1.5.0',
    entityStatus: EntityStatus.Approved,
    sourceWorkingRevision: 7,
    sealedAt: 1,
    sealedBy: 'author',
    memberCount: 1,
    totalBytes: 100,
    ontologyIri: 'urn:sales',
    versionIri: 'urn:sales:5',
    baseReleaseId: id(10),
    contentDigest: 'a'.repeat(64),
    logicalCheck: LogicalCheck.NotRun,
    encodingVersion: EncodingVersion.OntologyReleaseV1,
  };
  const previous = {
    ...release,
    id: id(10),
    releaseRevision: 1,
    semanticVersion: '1.0.0',
  };
  let state: OntologyState = {
    ontologyId: id(1),
    workingRevision: 7,
    activationRevision: 3,
    lastReleaseRevision: 5,
    activeReleaseId: previous.id,
  };
  let ontology: Ontology = {
    id: id(1),
    name: 'Sales',
    fullyQualifiedName: 'Sales',
    iri: 'urn:sales',
    namespace: 'urn:sales:',
    version: 0.1,
    reviewers: [{ id: id(3), type: 'user', name: 'reviewer' }],
    publicationStatus: {
      unpublishedChanges: 1,
      reviewLock: {},
      latest: {
        releaseId: release.id,
        releaseRevision: 5,
        semanticVersion: release.semanticVersion,
        stage: Stage.Approved,
      },
      active: {
        releaseId: previous.id,
        releaseRevision: 1,
        semanticVersion: previous.semanticVersion,
      },
    },
  };
  const validationResponse = (url: string) => {
    if (url.endsWith('/validation')) {
      return {
        data: {
          releaseId: release.id,
          contentDigest: release.contentDigest,
          baseReleaseId: release.baseReleaseId,
          valid: true,
          structure: {
            releaseId: release.id,
            contentDigest: release.contentDigest,
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
  const releaseResponse = (url: string) => {
    if (url.endsWith('/releases')) {
      return { data: { data: [release, previous], paging: { total: 2 } } };
    }
    if (url === '/ontologyReleases/' + release.id) {
      return { data: release };
    }
    if (url === '/ontologyReleases/' + previous.id) {
      return { data: previous };
    }

    return validationResponse(url);
  };
  get.mockImplementation(async (url) => {
    const validation = releaseResponse(url);
    if (validation) {
      return validation;
    }
    if (url === '/ontologies') {
      return { data: { data: [ontology], paging: { total: 1 } } };
    }
    if (url === '/ontologies/' + ontology.id) {
      return { data: ontology };
    }
    if (url.endsWith('/state')) {
      return { data: state };
    }
    if (url.endsWith('/working/diff')) {
      return {
        data: {
          state,
          data: [],
          paging: { total: state.activeReleaseId === release.id ? 0 : 1 },
        },
      };
    }
    if (
      [
        '/ontologyConcepts',
        '/ontologyProperties',
        '/ontologyAxioms',
        '/relationshipTypes',
      ].includes(url) ||
      url.endsWith('/events') ||
      url.endsWith('/diff')
    ) {
      return { data: { data: [], paging: { total: 0 } } };
    }

    throw new Error('Unexpected host request: ' + url);
  });
  put.mockImplementation(async () => {
    state = { ...state, activeReleaseId: release.id, activationRevision: 4 };
    ontology = {
      ...ontology,
      publicationStatus: {
        unpublishedChanges: 0,
        reviewLock: {},
        latest: {
          releaseId: release.id,
          releaseRevision: 5,
          semanticVersion: release.semanticVersion,
          stage: Stage.Published,
        },
        active: {
          releaseId: release.id,
          releaseRevision: 5,
          semanticVersion: release.semanticVersion,
        },
      },
    };

    return { data: state };
  });
  await act(async () => {
    renderWithQueryClient(
      <MemoryRouter initialEntries={['/?ontology=' + ontology.id]}>
        <OntologyExplorerPage />
      </MemoryRouter>
    );
  });

  expect(
    await screen.findByTestId('ontology-release-history-trigger')
  ).toHaveTextContent('1.0.0');
  expect(screen.getByTestId('ontology-publication-trigger')).toHaveTextContent(
    '(1)'
  );

  await act(async () => {
    fireEvent.click(screen.getByTestId('ontology-publication-trigger'));
  });
  await waitFor(() =>
    expect(screen.getByTestId('ontology-publish-release')).toBeEnabled()
  );
  await act(async () => {
    fireEvent.click(screen.getByTestId('ontology-publish-release'));
  });

  expect(put.mock.calls.map(([url, body]) => ({ url, body }))).toEqual([
    {
      url: '/ontologies/' + ontology.id + '/activation',
      body: { releaseId: release.id, expectedActivationRevision: 3 },
    },
  ]);
  expect(screen.getByTestId('ontology-release-stage')).toHaveTextContent(
    'label.published'
  );
  expect(
    screen.getByTestId('ontology-release-history-trigger')
  ).toHaveTextContent('1.5.0');
  expect(screen.getByTestId('ontology-publication-trigger')).toHaveTextContent(
    '(0)'
  );

  await act(async () => {
    fireEvent.click(screen.getByTestId('ontology-publication-tab-releases'));
  });
  const currentRow = screen
    .getByTestId('ontology-release-select-' + release.id)
    .closest('li');
  const oldRow = screen
    .getByTestId('ontology-release-select-' + previous.id)
    .closest('li');
  if (!currentRow || !oldRow) {
    throw new Error('Missing history');
  }

  expect(within(currentRow).getByText('label.active')).toBeVisible();
  expect(within(oldRow).queryByText('label.active')).not.toBeInTheDocument();

  const listRequests = get.mock.calls.filter(([url]) => url === '/ontologies');

  expect(listRequests.length).toBeGreaterThan(1);
  expect(
    listRequests.every(
      ([, config]) =>
        (config?.params as { fields?: string } | undefined)?.fields ===
        'publicationStatus'
    )
  ).toBe(true);
});
