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

import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mocked } from 'jest-mock';
import {
  OperationState,
  OperationType,
} from '../../generated/api/data/createOntologyChangeSet';
import {
  Format,
  OntologyPackManifest,
} from '../../generated/api/data/ontologyPackManifest';
import { OntologyChangeSetState } from '../../generated/entity/data/ontologyChangeSet';
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
const draft = {
  ...preview,
  id: 'draft-id',
  ontology: { id: target.id, type: 'ontology', fullyQualifiedName: 'Sales' },
  state: OntologyChangeSetState.Draft,
  undoCursor: preview.operations.length,
};
const lock = {
  acquiredAt: 1,
  expiresAt: Date.now() + 60000,
  renewedAt: 1,
  holder: { id: 'author', type: 'user' },
  resourceId: 'draft-id',
  resourceType: 'ontologyChangeSet',
  sessionId: 'session-id',
  version: 3,
};
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
const openInstalledPack = async () => {
  await screen.findByTestId('ontology-pack-fhir');

  expect(screen.getByTestId('ontology-library-close')).toBeEnabled();

  await openPack();

  return screen.findByTestId('ontology-library-open-graph');
};
const chooseExisting = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /label.install-to/ }));
  await user.click(await screen.findByRole('option', { name: 'Sales' }));
};
const creates = () => post.mock.calls.filter(([url]) => url === '/ontologies');
const drafts = () =>
  post.mock.calls.filter(([url]) => url === '/ontologyChangeSets');
let created = { ...target, id: 'created-id' };
const respond = async (url: string, data: unknown) => {
  if (url.includes('/library/')) {
    return { data: preview };
  }
  if (url === '/ontologyChangeSets') {
    return { data: draft };
  }
  if (url === '/ontologyChangeSets/draft-id/apply') {
    return { data: { ...draft, state: OntologyChangeSetState.Applied } };
  }
  if (url === '/ontologyEditLocks/acquire') {
    return { data: lock };
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
    permit(true);
    created = { ...target, id: 'created-id' };
    get.mockImplementation(async (url) => {
      if (url === '/ontologyPacks') {
        return { data: { packs: [pack] } };
      }

      return { data: url.includes('/ontologyEditLocks/') ? lock : draft };
    });
    post.mockImplementation(respond);
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

    expect(await openInstalledPack()).toBeVisible();

    const request = creates()[0][1];

    expect(request).toEqual(
      expect.objectContaining({
        displayName: pack.name,
        name: expect.stringMatching(/^fhir-/),
        iri: expect.stringMatching(/^urn:openmetadata:ontology:/),
        owners: [{ id: 'author', type: 'user' }],
        layer: 'L1',
      })
    );
    expect(Object(request).namespace).toBe(Object(request).iri + ':');
    expect(native.onCreated).toHaveBeenCalledTimes(1);
    expect(native.onApplied).toHaveBeenCalledWith(created);
    expect(post).toHaveBeenCalledWith(
      '/ontologies/created-id/library/fhir/preview',
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
      '/ontologies/created-id/library/fhir/preview',
      { moduleIds: ['core', 'clinical'] }
    );
  });

  it('installs into an explicitly chosen owner and completes no-op without a draft', async () => {
    post.mockResolvedValue({ data: { ...preview, operations: [] } });
    const native = nativeProps();
    renderWithQueryClient(<OntologyLibrary native={native} />);
    await openPack();
    await chooseExisting();
    await install();

    await openInstalledPack();

    expect(await screen.findByText('message.no-changes-to-save')).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-library-open-graph'));

    expect(native.onOpenOntology).toHaveBeenCalledWith(target);
    expect(creates()).toHaveLength(0);
    expect(drafts()).toHaveLength(0);
    expect(native.onApplied).not.toHaveBeenCalled();
  });

  it('retains the installed target and graph action across Back and reopening the pack', async () => {
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
    fireEvent.click(screen.getByTestId('ontology-library-back'));

    expect(await screen.findByTestId('ontology-pack-fhir')).toHaveTextContent(
      'label.installed'
    );
    expect(
      screen.getByTestId('ontology-library-installed-count')
    ).toBeVisible();

    await openPack();
    fireEvent.click(screen.getByTestId('ontology-library-open-graph'));

    expect(native.onOpenOntology).toHaveBeenCalledWith(created);
    expect(creates()).toHaveLength(1);
    expect(drafts()).toHaveLength(1);
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
      expect(post).not.toHaveBeenCalled();
    }
  );

  it('waits for the created target permission and resumes only after EditAll is granted', async () => {
    permit(true, true);
    const native = nativeProps();
    const view = renderWithQueryClient(<OntologyLibrary native={native} />);
    await openPack();
    await install();

    expect(creates()).toHaveLength(1);
    expect(post.mock.calls.some(([url]) => url.includes('/library/'))).toBe(
      false
    );
    expect(screen.getByTestId('ontology-library-close')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
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

      return { data: url.startsWith('/ontologies/name/') ? created : draft };
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
      if (url.startsWith('/ontologies/name/')) {
        if (lookupFails) {
          throw new Error('lookup unavailable');
        }

        return { data: created };
      }

      return { data: url === '/ontologyPacks' ? { packs: [pack] } : draft };
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
    expect(drafts()).toHaveLength(1);
  });

  it('keeps the created target on preview failure and retries its selected modules', async () => {
    let failPreview = true;
    post.mockImplementation(async (url, data) => {
      if (url.includes('/library/') && failPreview) {
        failPreview = false;

        throw new Error('preview failed');
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
    expect(drafts()).toHaveLength(1);
  });

  it('retains the same target and draft after a failed application', async () => {
    let failApply = true;
    post.mockImplementation(async (url, data) => {
      if (url.endsWith('/apply') && failApply) {
        failApply = false;

        return {
          data: { ...draft, state: OntologyChangeSetState.ApplyFailed },
        };
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
    expect(drafts()).toHaveLength(1);
  });
});
