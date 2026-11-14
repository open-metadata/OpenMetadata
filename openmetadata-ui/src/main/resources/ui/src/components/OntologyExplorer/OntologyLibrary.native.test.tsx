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

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mocked } from 'jest-mock';
import {
  OperationState,
  OperationType,
} from '../../generated/api/data/createOntologyChangeSet';
import {
  OntologyPackInstallJob,
  Status,
} from '../../generated/api/data/ontologyPackInstallJob';
import {
  Format,
  Industry,
  Layer,
  OntologyPackManifest,
} from '../../generated/api/data/ontologyPackManifest';
import { useIsAiMode } from '../../hooks/useAppMode';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import APIClient from '../../rest/axiosClient';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../test/unit/test-utils';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import OntologyLibrary from './OntologyLibrary';

jest.mock('../../rest/axiosClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));
let mockIdentityReady = true;
const mockFreshIdentity = jest.fn();
jest.mock(
  '../governance/ontology/OntologyCreateForm/useOntologyIdentitySource',
  () => ({
    useOntologyIdentitySource: () => ({
      isReady: mockIdentityReady,
      identityOf: () => undefined,
      refreshIdentityOf: async () => mockFreshIdentity,
    }),
  })
);
jest.mock('../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../hooks/useAppMode'),
  useIsAiMode: jest.fn().mockReturnValue(false),
}));
jest.mock('../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: jest.fn(),
}));
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: (
    selector: (state: { currentUser: { id: string } }) => unknown
  ) => selector({ currentUser: { id: 'author' } }),
}));
const target = {
  id: 'sales-id',
  name: 'Sales',
  fullyQualifiedName: 'Sales',
  iri: 'urn:sales',
  namespace: 'urn:sales:',
};
const pack: OntologyPackManifest = {
  id: 'fhir',
  industry: Industry.Healthcare,
  layer: Layer.L2,
  abbreviation: 'FHIR',
  name: 'FHIR Reference',
  version: '5.0.0',
  standard: 'FHIR R5',
  description: 'Healthcare concepts',
  bundled: true,
  license: 'CC0-1.0',
  licenseUrl: 'https://example.com/license',
  sourceUrl: 'https://example.com/fhir',
  modules: [
    {
      id: 'core',
      name: 'Core',
      description: 'Core concepts',
      format: Format.Turtle,
      conceptCount: 2,
      relationshipCount: 1,
      dependencies: [],
      selectedByDefault: true,
    },
    {
      id: 'clinical',
      name: 'Clinical',
      description: 'Clinical concepts',
      format: Format.Turtle,
      conceptCount: 3,
      relationshipCount: 2,
      dependencies: ['core'],
      selectedByDefault: false,
    },
  ],
};
const preview = {
  name: 'library-preview',
  displayName: 'Library preview',
  description: 'Import FHIR',
  ontology: 'Sales',
  baseWorkingRevision: 4,
  sourcePack: { packId: 'fhir', version: '5.0.0', moduleIds: ['core'] },
  operations: [
    {
      id: 'operation-id',
      operationType: OperationType.UpsertConcept,
      state: OperationState.Active,
      concept: {
        id: 'concept-id',
        name: 'Resource',
        displayName: 'FHIR Resource',
        iri: 'https://source.example/FHIR/Resource',
        ontology: { id: target.id, type: 'ontology' },
      },
    },
  ],
};
const installJob = (
  overrides: Partial<OntologyPackInstallJob> = {}
): OntologyPackInstallJob => ({
  id: 7,
  ontologyId: 'created-id',
  packId: 'fhir',
  version: '5.0.0',
  moduleIds: ['core'],
  status: Status.Completed,
  progress: 1,
  total: 1,
  membersApplied: 3,
  memberCount: 3,
  createdBy: 'author',
  createdAt: 1,
  updatedAt: 2,
  ...overrides,
});
const post = mocked<
  (...args: Parameters<typeof APIClient.post>) => Promise<{ data: unknown }>
>(APIClient.post);
const get = mocked<
  (...args: Parameters<typeof APIClient.get>) => Promise<{ data: unknown }>
>(APIClient.get);
const permissions = mocked(useEntityPermissions);
const permit = (canEdit: boolean, isLoading = false) => {
  const value = { ...DEFAULT_ENTITY_PERMISSION, EditAll: canEdit };
  permissions.mockReturnValue({
    permissions: value,
    ...getDerivedPermissionFlags(value, false),
    isLoading,
    error: null,
    refresh: jest.fn(),
  });
};
const nativeProps = () => ({
  ontologies: [target],
  initialOntology: target,
  canCreate: true,
  onCreated: jest.fn(),
  onApplied: jest.fn(),
  onOpenOntology: jest.fn(),
});
const openPack = async () => {
  await act(async () => undefined);
  fireEvent.click(await screen.findByTestId('ontology-pack-details-fhir'));
};
const install = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('ontology-library-native-install'));
  });
};
// The job poll resumes outside any user event, so its renders flush only when an act scope closes.
const untilRendered = async (assertion: () => void, timeoutMs = 4000) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
    try {
      assertion();

      return;
    } catch (error) {
      if (Date.now() > deadline) {
        throw error;
      }
    }
  }
};
const openInstalledPack = async () => {
  const card = await screen.findByTestId('ontology-pack-fhir');

  expect(screen.getByTestId('ontology-library-close')).toBeEnabled();

  return card;
};
const chooseExisting = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /label.install-to/ }));
  const option = await screen.findByRole('option', { name: 'Sales' });
  // The pack review starts from the click's re-render and resolves after user-event
  // returns; only a click held inside act() delivers that result to the tree.
  await act(async () => {
    await user.click(option);
  });
};
const creates = () => post.mock.calls.filter(([url]) => url === '/ontologies');
const installs = () =>
  post.mock.calls.filter(([url]) => String(url).endsWith('/install'));
const sampleResponse = () => ({
  data: {
    packId: pack.id,
    version: pack.version,
    moduleIds: ['core'],
    conceptCount: 2,
    relationCount: 1,
    concepts: [],
    relations: [],
  },
});
let created = { ...target, id: 'created-id' };
let catalogueInstallations: {
  ontology: { id: string; name: string; displayName?: string };
  installation: { packId: string };
}[] = [];
const respond = async (url: string, data: unknown) => {
  if (url.endsWith('/install')) {
    catalogueInstallations = [
      {
        ontology: {
          id: created.id,
          name: created.name,
        },
        installation: { packId: pack.id },
      },
    ];

    return { data: installJob() };
  }
  if (url.includes('/library/')) {
    return { data: preview };
  }
  if (url === '/ontologies') {
    created = {
      ...created,
      ...Object(data),
      fullyQualifiedName: Object(data).name,
    };

    return { data: created };
  }

  throw new Error('Unexpected request: ' + url);
};
runQueryNotificationsSynchronously();

beforeAll(() => jest.useRealTimers());

afterAll(() => jest.useFakeTimers());

describe('OntologyLibrary native installation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useIsAiMode as jest.Mock).mockReturnValue(false);
    permit(true);
    mockFreshIdentity.mockReset();
    created = { ...target, id: 'created-id' };
    catalogueInstallations = [];
    get.mockImplementation(async (url) => {
      if (url === '/ontologyPacks') {
        return {
          data: { packs: [pack], installations: catalogueInstallations },
        };
      }

      if (url.includes('/sample')) {
        return sampleResponse();
      }

      if (url === '/ontologies/created-id') {
        return { data: created };
      }

      return { data: {} };
    });
    post.mockImplementation(respond);
  });

  it('lists cross-industry packs under their own filter and shows the attribution a license requires', async () => {
    const dcat: OntologyPackManifest = {
      ...pack,
      id: 'dcat',
      abbreviation: 'DCAT',
      name: 'DCAT 3',
      industry: Industry.CrossIndustry,
      standard: 'Data Catalog Vocabulary (DCAT) Version 3',
      attribution:
        'DCAT Version 3, W3C Recommendation. Licensed under CC BY 4.0.',
    };
    get.mockImplementation(async (url) => {
      if (url === '/ontologyPacks') {
        return { data: { packs: [pack, dcat], installations: [] } };
      }
      if (url.includes('/sample')) {
        return { data: { ...sampleResponse().data, packId: dcat.id } };
      }

      return { data: {} };
    });
    renderWithQueryClient(<OntologyLibrary native={nativeProps()} />);
    await act(async () => undefined);
    await screen.findByTestId('ontology-pack-dcat');

    expect(
      screen.getByTestId('ontology-library-filter-cross-industry')
    ).toHaveTextContent('label.ontology-library-cross-industry');

    fireEvent.click(
      screen.getByTestId('ontology-library-filter-cross-industry')
    );

    expect(screen.getByTestId('ontology-pack-dcat')).toBeVisible();
    expect(screen.queryByTestId('ontology-pack-fhir')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-pack-details-dcat'));

    expect(screen.getByTestId('ontology-pack-attribution')).toHaveTextContent(
      dcat.attribution as string
    );
  });

  it('offers Install for a pack of any size because every install runs as a job', async () => {
    const fibo: OntologyPackManifest = {
      ...pack,
      id: 'fibo',
      abbreviation: 'FIBO',
      name: 'FIBO',
      industry: Industry.Finance,
    };
    get.mockImplementation(async (url) => {
      if (url === '/ontologyPacks') {
        return { data: { packs: [fibo], installations: [] } };
      }

      return { data: {} };
    });
    renderWithQueryClient(<OntologyLibrary native={nativeProps()} />);
    await act(async () => undefined);
    await screen.findByTestId('ontology-pack-fibo');
    fireEvent.click(screen.getByTestId('ontology-pack-details-fibo'));

    expect(
      await screen.findByTestId('ontology-library-native-install')
    ).toBeVisible();
  });

  it('filters native packs by industry and opens the aligned detail from the card action', async () => {
    const fibo: OntologyPackManifest = {
      ...pack,
      id: 'fibo',
      abbreviation: 'FIBO',
      name: 'FIBO',
      industry: Industry.Finance,
      standard: 'Financial Industry Business Ontology',
    };
    get.mockImplementation(async (url) => {
      if (url === '/ontologyPacks') {
        return { data: { packs: [pack, fibo], installations: [] } };
      }
      if (url.includes('/sample')) {
        return { data: { ...sampleResponse().data, packId: fibo.id } };
      }

      return { data: {} };
    });
    renderWithQueryClient(<OntologyLibrary native={nativeProps()} />);
    await act(async () => undefined);
    await screen.findByTestId('ontology-pack-fibo');
    fireEvent.click(screen.getByTestId('ontology-library-filter-finance'));

    expect(screen.getByTestId('ontology-pack-fibo')).toBeVisible();
    expect(screen.queryByTestId('ontology-pack-fhir')).not.toBeInTheDocument();

    const action = screen.getByTestId('ontology-pack-details-fibo');

    expect(action).toHaveClass('tw:after:absolute');
    expect(action).toHaveAccessibleName('label.view FIBO');

    fireEvent.click(action);

    expect(screen.getByTestId('ontology-pack-detail')).toHaveTextContent(
      'label.ontology-library-aligned-to'
    );
    expect(screen.getByTestId('ontology-pack-detail')).toHaveTextContent(
      fibo.standard
    );
  });

  it('defaults to a unique owned new ontology even when an existing owner is selected', async () => {
    const native = nativeProps();
    renderWithQueryClient(<OntologyLibrary native={native} />);
    await openPack();

    expect(
      screen.getByRole('button', { name: /label.install-to/ })
    ).toHaveTextContent('label.new-ontology-for-pack');
    expect(
      screen.queryByTestId('ontology-library-native-preview')
    ).not.toBeInTheDocument();

    await install();

    expect(await openInstalledPack()).toHaveTextContent('label.installed');

    const request = creates()[0][1];

    expect(request).toEqual(
      expect.objectContaining({
        displayName: pack.name,
        name: expect.stringMatching(/^fhir-/),
        iri: expect.stringMatching(/^urn:openmetadata:ontology:/),
        owners: [{ id: 'author', type: 'user' }],
        layer: 'L2',
      })
    );
    expect(Object(request).namespace).toBe(Object(request).iri + ':');
    expect(native.onCreated).toHaveBeenCalledTimes(1);
    expect(native.onApplied).toHaveBeenCalledWith(created);
    expect(post).toHaveBeenCalledWith(
      '/ontologies/created-id/library/fhir/install',
      { moduleIds: ['core'] }
    );
    expect(
      post.mock.calls.some(
        ([url]) => url.includes('/ontologyPacks/') || url.includes('/releases')
      )
    ).toBe(false);
    expect(
      mocked(APIClient.delete).mock.calls.some(([url]) =>
        url.startsWith('/ontologies/')
      )
    ).toBe(false);
  });

  it('names the new ontology from the ontology list read when Install is pressed', async () => {
    mockFreshIdentity.mockReturnValue({
      name: 'fhir-reference-2',
      displayName: 'FHIR Reference (2)',
      iri: 'urn:test:fhir-reference-2',
      namespace: 'urn:test:fhir-reference-2:',
    });
    renderWithQueryClient(<OntologyLibrary native={nativeProps()} />);
    await openPack();

    await install();

    expect(await openInstalledPack()).toBeVisible();
    expect(creates()[0][1]).toEqual(
      expect.objectContaining({
        name: 'fhir-reference-2',
        displayName: 'FHIR Reference (2)',
        iri: 'urn:test:fhir-reference-2',
      })
    );
  });

  it('keeps Install disabled for a new ontology until its name and IRI source has loaded', async () => {
    mockIdentityReady = false;
    try {
      renderWithQueryClient(<OntologyLibrary native={nativeProps()} />);
      await openPack();

      expect(
        await screen.findByTestId('ontology-library-native-install')
      ).toBeDisabled();
    } finally {
      mockIdentityReady = true;
    }
  });

  it('installs and opens the graph from the AI-mode pack detail', async () => {
    (useIsAiMode as jest.Mock).mockReturnValue(true);
    const native = nativeProps();
    renderWithQueryClient(<OntologyLibrary native={native} />);
    await openPack();

    expect(screen.getByTestId('ontology-pack-concept-count')).toHaveTextContent(
      '2'
    );
    expect(screen.getByTestId('ontology-library-cancel')).toBeEnabled();

    await install();

    expect(await openInstalledPack()).toBeVisible();
    expect(native.onApplied).toHaveBeenCalledWith(created);

    await openPack();
    fireEvent.click(
      screen.getByTestId('ontology-library-installed-in-created-id')
    );

    await waitFor(() =>
      expect(native.onOpenOntology).toHaveBeenCalledWith(created)
    );
  });

  it('keeps dependency selection and manifest counts in the single installation action', async () => {
    renderWithQueryClient(<OntologyLibrary native={nativeProps()} />);
    await openPack();
    fireEvent.click(screen.getByTestId('ontology-module-core'));

    expect(screen.getByTestId('ontology-pack-concept-count')).toHaveTextContent(
      '0'
    );

    fireEvent.click(screen.getByTestId('ontology-module-clinical'));

    expect(screen.getByTestId('ontology-pack-concept-count')).toHaveTextContent(
      '5'
    );
    expect(
      screen.getByTestId('ontology-pack-relationship-count')
    ).toHaveTextContent('3');

    await install();
    await openInstalledPack();

    expect(post).toHaveBeenCalledWith(
      '/ontologies/created-id/library/fhir/install',
      { moduleIds: ['core', 'clinical'] }
    );
  });

  it('keeps the modules the user selected when the target changes to an existing ontology', async () => {
    renderWithQueryClient(<OntologyLibrary native={nativeProps()} />);
    await openPack();

    expect(screen.getByTestId('ontology-pack-concept-count')).toHaveTextContent(
      '2'
    );

    await chooseExisting();

    expect(screen.getByTestId('ontology-pack-concept-count')).toHaveTextContent(
      '2'
    );

    fireEvent.click(screen.getByTestId('ontology-module-clinical'));

    expect(screen.getByTestId('ontology-pack-concept-count')).toHaveTextContent(
      '5'
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /label.install-to/ }));
    await user.click(
      await screen.findByRole('option', { name: /label.new-ontology-for-pack/ })
    );

    expect(screen.getByTestId('ontology-pack-concept-count')).toHaveTextContent(
      '5'
    );
    expect(
      screen.getByTestId('ontology-pack-relationship-count')
    ).toHaveTextContent('3');
  });

  it('installs into an explicitly chosen owner and completes a job with nothing to apply as unchanged', async () => {
    post.mockImplementation(async (url, data) =>
      url.endsWith('/install')
        ? { data: installJob({ total: 0, progress: 0, memberCount: 0 }) }
        : respond(url, data)
    );
    const native = nativeProps();
    renderWithQueryClient(<OntologyLibrary native={native} />);
    await openPack();
    await chooseExisting();
    await install();

    await openInstalledPack();

    expect(native.onOpenOntology).not.toHaveBeenCalled();
    expect(creates()).toHaveLength(0);
    expect(installs()).toHaveLength(1);
    expect(native.onApplied).not.toHaveBeenCalled();
  });

  it('retains the installed target from the server across Back and reopening the pack', async () => {
    const native = nativeProps();
    renderWithQueryClient(<OntologyLibrary native={native} />);

    expect(
      screen.queryByTestId('ontology-library-installed-count')
    ).not.toBeInTheDocument();

    await openPack();
    await install();

    expect(
      await screen.findByTestId('ontology-library-installed-count')
    ).toHaveTextContent('label.ontology-library-installed-count');
    expect(screen.getByTestId('ontology-pack-details-fhir')).toHaveTextContent(
      'label.view'
    );

    await openInstalledPack();
    await openPack();
    fireEvent.click(screen.getByTestId('ontology-library-back'));

    expect(await screen.findByTestId('ontology-pack-fhir')).toHaveTextContent(
      'label.installed'
    );
    expect(
      screen.getByTestId('ontology-library-installed-count')
    ).toBeVisible();

    await openPack();
    fireEvent.click(
      screen.getByTestId('ontology-library-installed-in-created-id')
    );

    await waitFor(() =>
      expect(native.onOpenOntology).toHaveBeenCalledWith(created)
    );

    expect(creates()).toHaveLength(1);
    expect(installs()).toHaveLength(1);
  });

  it.each([
    [false, false],
    [true, true],
  ])(
    'blocks an existing target with EditAll=%s and loading=%s',
    async (canEdit, loading) => {
      permit(canEdit, loading);
      renderWithQueryClient(<OntologyLibrary native={nativeProps()} />);
      await openPack();
      await chooseExisting();

      expect(
        screen.getByTestId('ontology-library-native-install')
      ).toBeDisabled();
      expect(
        post.mock.calls.filter(([url]) => !String(url).endsWith('/summary'))
      ).toHaveLength(0);
    }
  );

  it('waits for the created target permission and resumes only after EditAll is granted', async () => {
    permit(true, true);
    const native = nativeProps();
    const view = renderWithQueryClient(<OntologyLibrary native={native} />);
    await openPack();
    await install();

    expect(creates()).toHaveLength(1);
    expect(
      post.mock.calls.some(
        ([url]) => url.includes('/library/') && !url.endsWith('/summary')
      )
    ).toBe(false);
    expect(screen.getByTestId('ontology-library-close')).toBeDisabled();
    expect(screen.getByTestId('ontology-library-back')).toBeDisabled();

    permit(true);
    await act(async () => {
      view.rerender(<OntologyLibrary native={native} />);
    });

    expect(await openInstalledPack()).toBeVisible();
  });

  it('offers existing targets when new ontology creation is denied', async () => {
    renderWithQueryClient(
      <OntologyLibrary native={{ ...nativeProps(), canCreate: false }} />
    );
    await openPack();

    expect(
      screen.getByTestId('ontology-library-native-install')
    ).toBeDisabled();

    await chooseExisting();
    await install();

    expect(await openInstalledPack()).toBeVisible();
    expect(creates()).toHaveLength(0);
  });

  it('recovers a lost target-create response by frozen name and IRI without creating twice', async () => {
    let lost = true;
    post.mockImplementation(async (url, data) => {
      const response = await respond(url, data);
      if (url === '/ontologies' && lost) {
        lost = false;

        throw new Error('response lost');
      }

      return response;
    });
    get.mockImplementation(async (url) => {
      if (url === '/ontologyPacks') {
        return { data: { packs: [pack] } };
      }

      if (url.includes('/sample')) {
        return sampleResponse();
      }

      return { data: url.startsWith('/ontologies/name/') ? created : {} };
    });
    const native = nativeProps();
    renderWithQueryClient(<OntologyLibrary native={native} />);
    await openPack();
    await install();

    expect(await openInstalledPack()).toBeVisible();
    expect(get).toHaveBeenCalledWith('/ontologies/name/' + created.name);
    expect(creates()).toHaveLength(1);
    expect(native.onCreated).toHaveBeenCalledTimes(1);
  });

  it('retains an uncertain target when lookup fails and recovers it on retry', async () => {
    let lookupFails = true;
    post.mockImplementation(async (url, data) => {
      const response = await respond(url, data);
      if (url === '/ontologies') {
        throw new Error('response lost');
      }

      return response;
    });
    get.mockImplementation(async (url) => {
      if (url.includes('/sample')) {
        return sampleResponse();
      }
      if (url.startsWith('/ontologies/name/')) {
        if (lookupFails) {
          throw new Error('lookup unavailable');
        }

        return { data: created };
      }

      return { data: url === '/ontologyPacks' ? { packs: [pack] } : {} };
    });
    renderWithQueryClient(<OntologyLibrary native={nativeProps()} />);
    await openPack();
    await install();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'server.unexpected-error'
    );
    expect(screen.getByTestId('ontology-module-core')).toHaveAttribute(
      'data-disabled',
      'true'
    );

    lookupFails = false;
    await install();
    await openInstalledPack();

    expect(creates()).toHaveLength(1);
    expect(installs()).toHaveLength(1);
  });

  it('keeps the created target when starting the job fails and starts it again on retry', async () => {
    let failStart = true;
    post.mockImplementation(async (url, data) => {
      if (url.endsWith('/install') && failStart) {
        failStart = false;

        throw new Error('install could not start');
      }

      return respond(url, data);
    });
    renderWithQueryClient(<OntologyLibrary native={nativeProps()} />);
    await openPack();
    await install();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'server.unexpected-error'
    );

    await install();
    await openInstalledPack();

    expect(creates()).toHaveLength(1);
    expect(installs()).toHaveLength(2);
  });

  it('shows the failure of a job and starts a new job for the same target on retry', async () => {
    let failJob = true;
    post.mockImplementation(async (url, data) => {
      if (url.endsWith('/install') && failJob) {
        failJob = false;

        return {
          data: installJob({
            status: Status.Failed,
            progress: 0,
            membersApplied: 0,
            error: 'Slice 1 of 1 did not apply',
          }),
        };
      }

      return respond(url, data);
    });
    renderWithQueryClient(<OntologyLibrary native={nativeProps()} />);
    await openPack();
    await install();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Slice 1 of 1 did not apply'
    );

    await install();
    await openInstalledPack();

    expect(creates()).toHaveLength(1);
    expect(installs()).toHaveLength(2);
  });

  it('follows a running job to completion and reports its progress', async () => {
    post.mockImplementation(async (url, data) =>
      url.endsWith('/install')
        ? {
            data: installJob({
              status: Status.Running,
              total: 4,
              progress: 1,
              membersApplied: 1000,
              memberCount: 3800,
            }),
          }
        : respond(url, data)
    );
    get.mockImplementation(async (url) => {
      if (url === '/ontologyPacks') {
        return { data: { packs: [pack], installations: [] } };
      }
      if (url.includes('/sample')) {
        return sampleResponse();
      }
      if (url === '/ontologies/created-id/library/jobs/7') {
        return { data: installJob({ total: 4, progress: 4 }) };
      }

      return { data: created };
    });
    const native = nativeProps();
    renderWithQueryClient(<OntologyLibrary native={native} />);
    await openPack();
    await install();

    expect(
      await screen.findByTestId('ontology-library-install-progress')
    ).toHaveTextContent('message.ontology-library-install-progress');

    await waitFor(
      () => expect(native.onApplied).toHaveBeenCalledWith(created),
      {
        timeout: 4000,
      }
    );
  });

  it('cancels a running job and offers to continue it', async () => {
    const running = installJob({
      status: Status.Running,
      total: 4,
      progress: 1,
    });
    post.mockImplementation(async (url, data) =>
      url.endsWith('/install') ? { data: running } : respond(url, data)
    );
    mocked(APIClient.put).mockResolvedValue({
      data: installJob({ status: Status.Cancelled, total: 4, progress: 1 }),
    });
    get.mockImplementation(async (url) => {
      if (url === '/ontologyPacks') {
        return { data: { packs: [pack], installations: [] } };
      }
      if (url.includes('/sample')) {
        return sampleResponse();
      }
      if (url === '/ontologies/created-id/library/jobs/7') {
        return {
          data: installJob({
            status: Status.Cancelled,
            total: 4,
            progress: 1,
          }),
        };
      }

      return { data: created };
    });
    renderWithQueryClient(<OntologyLibrary native={nativeProps()} />);
    await openPack();
    await install();
    const cancel = await screen.findByTestId('ontology-library-install-cancel');
    await act(async () => {
      fireEvent.click(cancel);
    });
    await waitFor(() => expect(mocked(APIClient.put)).toHaveBeenCalled());

    await untilRendered(() =>
      expect(
        screen.getByText('message.ontology-library-install-cancelled')
      ).toBeVisible()
    );

    expect(mocked(APIClient.put)).toHaveBeenCalledWith(
      '/ontologies/created-id/library/jobs/7/cancel'
    );
    expect(
      screen.getByTestId('ontology-library-native-install')
    ).toHaveTextContent('label.retry');
  });
});
