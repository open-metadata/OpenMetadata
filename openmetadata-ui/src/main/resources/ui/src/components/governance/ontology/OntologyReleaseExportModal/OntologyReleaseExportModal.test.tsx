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
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosResponse } from 'axios';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  CreateOntologyChangeSet,
  OperationState,
  OperationType,
} from '../../../../generated/api/data/createOntologyChangeSet';
import { Format } from '../../../../generated/api/data/nativeOntologyImportSummary';
import {
  FindingSeverity,
  OntologyReleaseValidation,
} from '../../../../generated/api/data/ontologyReleaseValidation';
import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  OntologyChangeSet,
  OntologyChangeSetState,
} from '../../../../generated/entity/data/ontologyChangeSet';
import {
  EncodingVersion,
  EntityStatus,
  LogicalCheck,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import {
  acquireOntologyEditLock,
  applyOntologyChangeSet,
  createOntologyChangeSet,
  detectNativeOntologyImportFormat,
  exportOntologyDraft,
  exportOntologyRelease,
  getOntologyChangeSet,
  getOntologyRelease,
  getOntologyReleaseValidation,
  getOntologyState,
  listOntologyReleaseHistory,
  previewNativeOntologyImport,
  releaseOntologyEditLock,
} from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { downloadFile } from '../../../../utils/Export/ExportUtils';
import OntologyNativeImportDialog from '../OntologyNativeImportDialog/OntologyNativeImportDialog';
import OntologyReleaseExportModal from './OntologyReleaseExportModal';

jest.mock('../../../../rest/ontologyAPI', () => ({
  acquireOntologyEditLock: jest.fn(),
  applyOntologyChangeSet: jest.fn(),
  createOntologyChangeSet: jest.fn(),
  getOntologyChangeSet: jest.fn(),
  createOntology: jest.fn(),
  detectNativeOntologyImportFormat: jest.fn(),
  getOntologyByName: jest.fn(),
  listOntologyChangeSets: jest.fn(),
  previewNativeOntologyImport: jest.fn(),
  previewNativeOntologyImportWithoutTarget: jest.fn(),
  releaseOntologyEditLock: jest.fn(),
  exportOntologyRelease: jest.fn(),
  exportOntologyDraft: jest.fn(),
  listOntologyReleaseHistory: jest.fn(),
  getOntologyRelease: jest.fn(),
  getOntologyReleaseValidation: jest.fn(),
  getOntologyState: jest.fn(),
}));

jest.mock('../OntologyCreateForm/useOntologyIdentitySource', () => ({
  useOntologyIdentitySource: () => ({
    isReady: true,
    identityOf: () => undefined,
  }),
}));
jest.mock(
  '../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: () => ({
      canEditAll: true,
      isLoading: false,
      error: null,
    }),
  })
);
jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true }),
}));
jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));
jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: (
    selector: (state: { currentUser: { id: string } }) => unknown
  ) => selector({ currentUser: { id: 'author' } }),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../utils/Export/ExportUtils', () => ({
  downloadFile: jest.fn(),
}));

const ontology: Ontology = {
  fullyQualifiedName: 'Sales',
  id: 'ontology-id',
  iri: 'urn:sales',
  name: 'Sales',
  namespace: 'urn:sales:',
};

const release: OntologyRelease = {
  contentDigest: 'a'.repeat(64),
  encodingVersion: EncodingVersion.OntologyReleaseV1,
  entityStatus: EntityStatus.Approved,
  fullyQualifiedName: 'Sales.Release1',
  id: 'release-id',
  logicalCheck: LogicalCheck.NotRun,
  memberCount: 2,
  name: 'Release 1',
  ontology: { id: ontology.id, type: 'ontology' },
  ontologyIri: ontology.iri,
  releaseRevision: 1,
  sealedAt: 1,
  sealedBy: 'author',
  sourceWorkingRevision: 7,
  totalBytes: 100,
  versionIri: 'urn:sales:v1',
};

const mockExportOntologyRelease = exportOntologyRelease as jest.MockedFunction<
  typeof exportOntologyRelease
>;
const mockExportDraft = exportOntologyDraft as jest.MockedFunction<
  typeof exportOntologyDraft
>;
const mockListHistory = listOntologyReleaseHistory as jest.MockedFunction<
  typeof listOntologyReleaseHistory
>;
const mockGetOntologyRelease = getOntologyRelease as jest.MockedFunction<
  typeof getOntologyRelease
>;
const mockGetValidation = getOntologyReleaseValidation as jest.MockedFunction<
  typeof getOntologyReleaseValidation
>;
const mockGetOntologyState = getOntologyState as jest.MockedFunction<
  typeof getOntologyState
>;
const mockDownloadFile = downloadFile as jest.MockedFunction<
  typeof downloadFile
>;
const mockCreateChangeSet = createOntologyChangeSet as jest.MockedFunction<
  typeof createOntologyChangeSet
>;
const mockApplyChangeSet = applyOntologyChangeSet as jest.MockedFunction<
  typeof applyOntologyChangeSet
>;

describe('OntologyReleaseExportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOntologyState.mockResolvedValue({
      activationRevision: 1,
      activeReleaseId: release.id,
      lastReleaseRevision: 1,
      ontologyId: ontology.id,
      workingRevision: 7,
    });
    mockGetOntologyRelease.mockResolvedValue(release);
    mockListHistory.mockResolvedValue({
      data: [release],
      paging: { total: 1 },
    });
    mockExportDraft.mockResolvedValue('<rdf>draft</rdf>');
    mockExportOntologyRelease.mockResolvedValue('<rdf>sealed release</rdf>');
  });

  it('previews the active immutable release in the chosen format and downloads the selected format', async () => {
    const onClose = jest.fn();
    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleaseExportModal ontology={ontology} onClose={onClose} />
      </MemoryRouter>
    );

    expect(
      await screen.findByTestId('ontology-export-scope')
    ).toHaveTextContent('Release 1 · label.active');
    expect(
      screen.getByRole('dialog', { name: 'label.export-ontology-title' })
    ).toBeVisible();
    expect(
      screen.getByTestId('ontology-transfer-dialog-subtitle')
    ).toHaveTextContent('Sales');
    expect(screen.getByRole('radio', { name: /label.rdf-xml/ })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /label.turtle/ })
    ).not.toBeChecked();
    expect(
      screen.getByRole('radio', { name: /label.published-release/ })
    ).toBeChecked();
    expect(
      await screen.findByTestId('ontology-release-export-preview')
    ).toHaveTextContent('<rdf>sealed release</rdf>');
    expect(screen.getByTestId('ontology-export-file-name')).toHaveTextContent(
      'sales.rdf'
    );
    expect(mockExportOntologyRelease).toHaveBeenLastCalledWith(
      release.id,
      'rdfxml',
      { includeBoundAssets: false, includeInverses: true },
      expect.any(AbortSignal)
    );

    const exportButton = screen.getByTestId('ontology-run-release-export');
    await waitFor(() => expect(exportButton).toBeEnabled());
    fireEvent.click(exportButton);

    await waitFor(() => expect(mockDownloadFile).toHaveBeenCalled());

    expect(mockExportOntologyRelease).toHaveBeenLastCalledWith(
      release.id,
      'rdfxml',
      { includeBoundAssets: false, includeInverses: true, shaclGate: false }
    );
    expect(mockDownloadFile).toHaveBeenCalledWith(
      '<rdf>sealed release</rdf>',
      'sales.rdf',
      'application/rdf+xml'
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('downloads the current draft chosen under Contents and cancels', async () => {
    const onClose = jest.fn();
    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleaseExportModal ontology={ontology} onClose={onClose} />
      </MemoryRouter>
    );
    await screen.findByTestId('ontology-release-export-preview');

    fireEvent.click(screen.getByRole('radio', { name: /label.current-draft/ }));
    fireEvent.click(screen.getByRole('radio', { name: /label.turtle/ }));

    await waitFor(() =>
      expect(mockExportDraft).toHaveBeenLastCalledWith(
        ontology.id,
        'turtle',
        { includeInverses: true },
        expect.any(AbortSignal)
      )
    );

    expect(screen.getByTestId('ontology-export-file-name')).toHaveTextContent(
      'sales-draft.ttl'
    );
    expect(screen.getByTestId('ontology-export-scope')).toHaveTextContent(
      'label.current-draft'
    );

    const exportButton = screen.getByTestId('ontology-run-release-export');
    await waitFor(() => expect(exportButton).toBeEnabled());
    fireEvent.click(exportButton);

    expect(mockDownloadFile).toHaveBeenCalledWith(
      '<rdf>draft</rdf>',
      'sales-draft.ttl',
      'text/turtle'
    );

    fireEvent.click(screen.getByTestId('ontology-release-export-cancel'));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('blocks the export in the footer while the SHACL gate reports a violation', async () => {
    mockGetValidation.mockResolvedValue({
      contentDigest: release.contentDigest,
      deprecationImpacts: [],
      releaseId: release.id,
      shacl: {
        findings: [
          {
            focusIri: 'urn:sales:Broken',
            message: 'A concept needs a label',
            severity: FindingSeverity.Violation,
            shapeIri: 'urn:shape',
          },
        ],
        truncated: false,
        violationCount: 1,
        warningCount: 0,
      },
      structure: { valid: true, violationCount: 0, violations: [] },
      valid: false,
    } as unknown as OntologyReleaseValidation);
    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleaseExportModal ontology={ontology} onClose={jest.fn()} />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('ontology-run-release-export')).toBeEnabled()
    );
    fireEvent.click(screen.getByTestId('ontology-export-shacl-gate'));
    fireEvent.click(screen.getByTestId('ontology-run-export-shacl'));

    expect(
      await screen.findByTestId('ontology-export-shacl-findings')
    ).toHaveTextContent('urn:sales:Broken');
    expect(
      screen.getByTestId('ontology-release-export-cancel').parentElement
    ).toContainElement(screen.getByTestId('ontology-run-release-export'));
    expect(screen.getByTestId('ontology-run-release-export')).toBeDisabled();
    expect(screen.getByTestId('ontology-release-export-cancel')).toBeEnabled();

    fireEvent.click(screen.getByTestId('ontology-export-shacl-gate'));

    await waitFor(() =>
      expect(screen.getByTestId('ontology-run-release-export')).toBeEnabled()
    );
  });

  it('offers the current draft when the ontology has no active release', async () => {
    mockGetOntologyState.mockResolvedValue({
      activationRevision: 1,
      lastReleaseRevision: 0,
      ontologyId: ontology.id,
      workingRevision: 0,
    });
    mockListHistory.mockResolvedValue({ data: [], paging: { total: 0 } });

    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleaseExportModal ontology={ontology} onClose={jest.fn()} />
      </MemoryRouter>
    );

    expect(
      await screen.findByTestId('ontology-export-scope')
    ).toHaveTextContent('label.current-draft');
    expect(
      await screen.findByTestId('ontology-release-export-preview')
    ).toHaveTextContent('<rdf>draft</rdf>');
    expect(
      screen.getByRole('radio', { name: /label.published-release/ })
    ).toBeDisabled();
    expect(
      screen.getByRole('radio', { name: /label.current-draft/ })
    ).toBeChecked();
    expect(mockExportDraft).toHaveBeenLastCalledWith(
      ontology.id,
      'rdfxml',
      { includeInverses: true },
      expect.any(AbortSignal)
    );
    expect(mockExportOntologyRelease).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.getByTestId('ontology-run-release-export')).toBeEnabled()
    );
    fireEvent.click(screen.getByTestId('ontology-run-release-export'));

    await waitFor(() => expect(mockDownloadFile).toHaveBeenCalled());

    expect(mockDownloadFile).toHaveBeenCalledWith(
      '<rdf>draft</rdf>',
      'sales-draft.rdf',
      'application/rdf+xml'
    );
  });

  it('lists older releases beside the draft and previews the one chosen', async () => {
    const older: OntologyRelease = {
      ...release,
      id: 'older-release-id',
      name: 'Release 0',
      fullyQualifiedName: 'Sales.Release0',
      releaseRevision: 0,
    };
    mockListHistory.mockResolvedValue({
      data: [release, older],
      paging: { total: 2 },
    });
    mockExportOntologyRelease.mockImplementation(async (id) =>
      id === older.id ? '<rdf>older release</rdf>' : '<rdf>sealed release</rdf>'
    );

    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleaseExportModal ontology={ontology} onClose={jest.fn()} />
      </MemoryRouter>
    );

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.click(await screen.findByTestId('ontology-export-advanced'));
    const trigger = within(
      await screen.findByTestId('ontology-export-scope')
    ).getByRole('button');
    await waitFor(() => expect(trigger).toHaveTextContent('Release 1'));
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(
      await screen.findByRole('option', { name: /label\.current-draft/ })
    ).toBeVisible();
    expect(screen.getByRole('option', { name: /Release 0/ })).toBeVisible();

    await user.click(screen.getByRole('option', { name: /Release 0/ }));

    expect(await screen.findByText('<rdf>older release</rdf>')).toBeVisible();
    expect(
      screen.getByRole('radio', { name: /label.published-release/ })
    ).not.toBeChecked();
    expect(
      screen.getByRole('radio', { name: /label.current-draft/ })
    ).not.toBeChecked();
    expect(screen.getByTestId('ontology-export-file-name')).toHaveTextContent(
      'sales-release-0.rdf'
    );
  });

  it('keeps the modal open and permits retry after loading fails', async () => {
    mockGetOntologyState.mockRejectedValueOnce(new Error('temporarily down'));

    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleaseExportModal ontology={ontology} onClose={jest.fn()} />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('message.ontology-export-failed')
    ).toBeVisible();
    expect(
      screen.queryByText('message.ontology-review-unavailable')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /label.rdf-xml/ })).toBeChecked();
    expect(
      screen.getByRole('radio', { name: /label.current-draft/ })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));

    await waitFor(() =>
      expect(screen.getByTestId('ontology-export-scope')).toHaveTextContent(
        'Release 1 · label.active'
      )
    );

    expect(mockGetOntologyState).toHaveBeenCalledTimes(2);
  });

  it('shows the server reason when the export is refused', async () => {
    mockExportOntologyRelease.mockRejectedValueOnce({
      response: {
        data: JSON.stringify({
          code: 400,
          message: 'Not an RDF IRI: <urn:bad>',
        }),
        status: 400,
      },
    });

    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleaseExportModal ontology={ontology} onClose={jest.fn()} />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(
        'message.ontology-export-failed Not an RDF IRI: <urn:bad>'
      )
    ).toBeVisible();
  });

  describe('native formats, options, and the SHACL gate', () => {
    const invalidReport = {
      contentDigest: release.contentDigest,
      deprecationImpacts: [],
      releaseId: release.id,
      shacl: {
        findings: [
          {
            focusIri: 'urn:sales:Broken',
            message: 'A concept needs a label',
            severity: FindingSeverity.Violation,
            shapeIri: 'urn:shape',
          },
        ],
        truncated: false,
        violationCount: 1,
        warningCount: 0,
      },
      structure: { valid: true, violationCount: 0, violations: [] },
      valid: false,
    } as unknown as OntologyReleaseValidation;

    const renderModal = async () => {
      const onClose = jest.fn();
      renderWithQueryClient(
        <MemoryRouter>
          <OntologyReleaseExportModal ontology={ontology} onClose={onClose} />
        </MemoryRouter>
      );
      await screen.findByTestId('ontology-release-export-preview');

      return onClose;
    };
    const lastCall = () => mockExportOntologyRelease.mock.calls.at(-1);

    it('offers the five formats and previews SKOS and SKOS-XL as written', async () => {
      await renderModal();
      for (const card of ['turtle', 'rdfxml', 'jsonld', 'csv', 'skos']) {
        expect(
          screen.getByTestId(`ontology-release-format-${card}`)
        ).toBeVisible();
      }

      expect(
        screen.queryByTestId('ontology-export-skos-xl')
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('ontology-release-format-skos'));
      await waitFor(() => expect(lastCall()?.[1]).toBe('skos'));

      fireEvent.click(screen.getByTestId('ontology-export-skos-xl'));
      await waitFor(() => expect(lastCall()?.[1]).toBe('skos-xl'));

      fireEvent.click(screen.getByTestId('ontology-release-format-csv'));
      await waitFor(() => expect(lastCall()?.[1]).toBe('csv'));

      expect(
        screen.queryByTestId('ontology-export-skos-xl')
      ).not.toBeInTheDocument();
    });

    it('refreshes the Turtle preview with each content option', async () => {
      await renderModal();
      fireEvent.click(screen.getByTestId('ontology-release-format-turtle'));
      await waitFor(() => expect(lastCall()?.[1]).toBe('turtle'));

      fireEvent.click(screen.getByTestId('ontology-export-bound-assets'));
      await waitFor(() =>
        expect(lastCall()?.[2]).toEqual({
          includeBoundAssets: true,
          includeInverses: true,
        })
      );

      fireEvent.click(screen.getByTestId('ontology-export-inverses'));
      await waitFor(() =>
        expect(lastCall()?.slice(1, 3)).toEqual([
          'turtle',
          { includeBoundAssets: true, includeInverses: false },
        ])
      );
    });

    it('never asks CSV for bound asset links', async () => {
      await renderModal();
      fireEvent.click(screen.getByTestId('ontology-export-advanced'));
      fireEvent.click(screen.getByTestId('ontology-export-bound-assets'));
      fireEvent.click(screen.getByTestId('ontology-release-format-csv'));

      await waitFor(() => expect(lastCall()?.[1]).toBe('csv'));

      expect(lastCall()?.[2]).toEqual({
        includeBoundAssets: false,
        includeInverses: true,
      });
      expect(
        within(screen.getByTestId('ontology-export-bound-assets')).getByRole(
          'checkbox'
        )
      ).toBeDisabled();
    });

    it('shows the SHACL report and blocks the download while the gate is on', async () => {
      mockGetValidation.mockResolvedValue(invalidReport);
      await renderModal();
      fireEvent.click(screen.getByTestId('ontology-export-shacl-gate'));
      fireEvent.click(screen.getByTestId('ontology-run-export-shacl'));

      expect(
        await screen.findByTestId('ontology-export-shacl-status')
      ).toHaveTextContent('message.shacl-violation-count');
      expect(
        screen.getByTestId('ontology-export-shacl-findings')
      ).toHaveTextContent('urn:sales:Broken');
      expect(screen.getByTestId('ontology-run-release-export')).toBeDisabled();

      fireEvent.click(screen.getByTestId('ontology-export-shacl-gate'));

      await waitFor(() =>
        expect(screen.getByTestId('ontology-run-release-export')).toBeEnabled()
      );
    });

    it('shows the report a gated download is refused with and starts no download', async () => {
      const onClose = await renderModal();
      mockExportOntologyRelease.mockRejectedValueOnce(
        new AxiosError('blocked', 'ERR_BAD_REQUEST', undefined, undefined, {
          data: invalidReport,
          status: 422,
        } as AxiosResponse)
      );
      fireEvent.click(screen.getByTestId('ontology-export-shacl-gate'));
      fireEvent.click(screen.getByTestId('ontology-run-release-export'));

      expect(
        await screen.findByTestId('ontology-export-shacl-status')
      ).toHaveTextContent('message.shacl-violation-count');
      expect(lastCall()?.[2]).toEqual({
        includeBoundAssets: false,
        includeInverses: true,
        shaclGate: true,
      });
      expect(mockDownloadFile).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

const importPlan = {
  baseWorkingRevision: 7,
  name: 'native-import-one',
  displayName: 'Native import',
  description: '',
  ontology: 'Sales',
  operations: [
    {
      id: 'operation-id',
      operationType: OperationType.UpsertConcept,
      state: OperationState.Active,
    },
  ],
} satisfies CreateOntologyChangeSet;
const importSummary = {
  detectedFormat: Format.Ntriples,
  counts: {
    newConcepts: 1,
    updatedConcepts: 0,
    newProperties: 0,
    updatedProperties: 0,
    newRelations: 0,
    newMappings: 0,
    skippedDefinitions: 0,
    skippedRelations: 0,
  },
};
const importDraft: OntologyChangeSet = {
  ...importPlan,
  id: 'draft-id',
  fullyQualifiedName: 'Sales.native-import-one',
  ontology: { id: ontology.id, type: 'ontology', fullyQualifiedName: 'Sales' },
  state: OntologyChangeSetState.Draft,
  undoCursor: 1,
};

const dismissImportModal = async (
  action: string,
  user: ReturnType<typeof userEvent.setup>
) => {
  if (action === 'Cancel') {
    await user.click(screen.getByTestId('ontology-native-import-cancel'));
  } else if (action === 'header close') {
    await user.click(screen.getByRole('button', { name: 'label.close' }));
  } else if (action === 'Escape') {
    act(() => screen.getByRole('dialog').focus());
    await user.keyboard('{Escape}');
  } else if (action === 'outside click') {
    const overlay = screen.getByRole('dialog').parentElement?.parentElement;
    if (!overlay) {
      throw new Error('Missing modal overlay');
    }
    await user.click(overlay);
  }
};

const ImportModalOwner = ({
  onApplied,
  onClose,
}: {
  onApplied: () => void;
  onClose: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return isOpen ? (
    <OntologyNativeImportDialog
      canImport
      ontology={ontology}
      onApplied={onApplied}
      onClose={() => {
        setIsOpen(false);
        onClose();
      }}
    />
  ) : null;
};

describe('OntologyNativeImportDialog import lifetime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOntologyState.mockResolvedValue({
      activationRevision: 1,
      activeReleaseId: release.id,
      lastReleaseRevision: 1,
      ontologyId: ontology.id,
      workingRevision: 7,
    });
    mockGetOntologyRelease.mockResolvedValue(release);
    mockExportOntologyRelease.mockResolvedValue('<rdf>sealed release</rdf>');
    (
      previewNativeOntologyImport as jest.MockedFunction<
        typeof previewNativeOntologyImport
      >
    ).mockResolvedValue({
      summary: importSummary,
      changeSet: importPlan,
    });
    (
      detectNativeOntologyImportFormat as jest.MockedFunction<
        typeof detectNativeOntologyImportFormat
      >
    ).mockResolvedValue({ detectedFormat: 'ntriples' } as never);
    (
      getOntologyChangeSet as jest.MockedFunction<typeof getOntologyChangeSet>
    ).mockResolvedValue(importDraft);
    mockApplyChangeSet.mockResolvedValue({
      ...importDraft,
      state: OntologyChangeSetState.Applied,
    });
    (
      acquireOntologyEditLock as jest.MockedFunction<
        typeof acquireOntologyEditLock
      >
    ).mockImplementation(async (request) => ({
      ...request,
      version: 2,
      acquiredAt: 1,
      renewedAt: 1,
      expiresAt: 60001,
      holder: { id: 'author', type: 'user' },
    }));
    (
      releaseOntologyEditLock as jest.MockedFunction<
        typeof releaseOntologyEditLock
      >
    ).mockResolvedValue(undefined);
  });

  it.each([
    'no navigation',
    'Cancel',
    'header close',
    'Escape',
    'outside click',
  ])(
    'finishes one import after %s is attempted while draft creation is pending',
    async (action) => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onApplied = jest.fn();
      const onClose = jest.fn();
      let resolveCreate: (draft: OntologyChangeSet) => void = jest.fn();
      mockCreateChangeSet.mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
      );
      renderWithQueryClient(
        <MemoryRouter>
          <ImportModalOwner onApplied={onApplied} onClose={onClose} />
        </MemoryRouter>
      );
      const input = document.querySelector('input[type="file"]');
      if (!input) {
        throw new Error('Missing file input');
      }
      const file = new File(['<urn:Customer> a <urn:Class> .'], 'sales.nt');
      Object.defineProperty(file, 'text', {
        value: jest.fn().mockResolvedValue('<urn:Customer> a <urn:Class> .'),
      });
      fireEvent.change(input, { target: { files: [file] } });
      await screen.findByTestId('ontology-native-import-result');
      await user.click(screen.getByTestId('ontology-native-import-apply'));
      await waitFor(() =>
        expect(createOntologyChangeSet).toHaveBeenCalledTimes(1)
      );

      await dismissImportModal(action, user);
      await act(async () => resolveCreate(importDraft));

      await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

      expect(createOntologyChangeSet).toHaveBeenCalledTimes(1);
      expect(acquireOntologyEditLock).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 'draft-id',
          resourceType: 'ontologyChangeSet',
        })
      );
      expect(applyOntologyChangeSet).toHaveBeenCalledTimes(1);
      expect(applyOntologyChangeSet).toHaveBeenCalledWith('draft-id', {
        lease: { sessionId: expect.any(String), version: 2 },
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
  );

  it.each(['retry', 'dismiss'])(
    'permits %s after an import failure settles',
    async (action) => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onApplied = jest.fn();
      const onClose = jest.fn();
      mockCreateChangeSet.mockResolvedValue(importDraft);
      mockApplyChangeSet.mockRejectedValueOnce(new Error('network'));
      renderWithQueryClient(
        <MemoryRouter>
          <ImportModalOwner onApplied={onApplied} onClose={onClose} />
        </MemoryRouter>
      );
      const input = document.querySelector('input[type="file"]');
      if (!input) {
        throw new Error('Missing file input');
      }
      const file = new File(['<urn:Customer> a <urn:Class> .'], 'sales.nt');
      Object.defineProperty(file, 'text', {
        value: jest.fn().mockResolvedValue('<urn:Customer> a <urn:Class> .'),
      });
      fireEvent.change(input, { target: { files: [file] } });
      await screen.findByTestId('ontology-native-import-result');
      await user.click(screen.getByTestId('ontology-native-import-apply'));
      await screen.findByRole('alert');

      expect(screen.getByTestId('ontology-native-import-cancel')).toBeEnabled();
      expect(screen.getByRole('button', { name: 'label.close' })).toBeEnabled();
      expect(screen.getByTestId('ontology-native-import-apply')).toBeEnabled();
      expect(onClose).not.toHaveBeenCalled();

      if (action === 'retry') {
        await user.click(screen.getByTestId('ontology-native-import-apply'));
        await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

        expect(applyOntologyChangeSet).toHaveBeenCalledTimes(2);
      } else {
        await user.click(screen.getByRole('button', { name: 'label.close' }));

        expect(onApplied).not.toHaveBeenCalled();
      }

      expect(createOntologyChangeSet).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
  );

  it.each(['Cancel', 'header close', 'Escape', 'outside click'])(
    'allows %s to dismiss an idle modal',
    async (action) => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onClose = jest.fn();
      renderWithQueryClient(
        <MemoryRouter>
          <ImportModalOwner onApplied={jest.fn()} onClose={onClose} />
        </MemoryRouter>
      );

      expect(
        screen.getByRole('dialog', { name: 'label.import-into-ontology' })
      ).toBeVisible();

      await dismissImportModal(action, user);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
  );
});
