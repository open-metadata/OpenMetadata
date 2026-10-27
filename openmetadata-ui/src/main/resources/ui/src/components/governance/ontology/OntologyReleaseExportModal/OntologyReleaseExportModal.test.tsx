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
import { AxiosError, AxiosResponse } from 'axios';
import userEvent from '@testing-library/user-event';
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
  exportOntologyRelease,
  getOntologyChangeSet,
  getOntologyRelease,
  getOntologyReleaseValidation,
  getOntologyState,
  previewNativeOntologyImport,
  releaseOntologyEditLock,
} from '../../../../rest/ontologyAPI';
import { renderWithQueryClient } from '../../../../test/unit/test-utils';
import { downloadFile } from '../../../../utils/Export/ExportUtils';
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
  getOntologyRelease: jest.fn(),
  getOntologyReleaseValidation: jest.fn(),
  getOntologyState: jest.fn(),
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
    mockExportOntologyRelease.mockResolvedValue('<rdf>sealed release</rdf>');
  });

  it('previews the active immutable release as Turtle and downloads the selected format', async () => {
    const onClose = jest.fn();
    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleaseExportModal ontology={ontology} onClose={onClose} />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Release 1/)).toBeVisible();
    expect(
      screen.getByRole('dialog', { name: 'label.import-export-ontology' })
    ).toBeVisible();
    expect(screen.getByText('Sales')).toBeVisible();
    expect(
      await screen.findByTestId('ontology-release-export-preview')
    ).toHaveTextContent('<rdf>sealed release</rdf>');
    expect(mockExportOntologyRelease).toHaveBeenLastCalledWith(
      release.id,
      'turtle',
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
      'Sales-release-1.rdf',
      'application/rdf+xml'
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('supports keyboard tab navigation and keeps the selected format and import permission', async () => {
    const user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
    });
    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleaseExportModal ontology={ontology} onClose={jest.fn()} />
      </MemoryRouter>
    );
    await screen.findByTestId('ontology-release-export-preview');
    await user.click(screen.getByRole('radio', { name: /label.json-ld/ }));
    const exportTab = screen.getByRole('tab', { name: 'label.export' });
    const importTab = screen.getByRole('tab', { name: 'label.import' });
    await user.click(exportTab);
    await user.keyboard('{ArrowRight}');

    expect(importTab).toHaveFocus();
    expect(importTab).toHaveAttribute('aria-selected', 'false');

    await user.keyboard('{Enter}');

    expect(
      screen.getByRole('tabpanel', { name: 'label.import' })
    ).toBeVisible();
    expect(screen.getByTestId('ontology-native-import-file')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
    expect(
      screen.queryByTestId('ontology-run-release-export')
    ).not.toBeInTheDocument();

    await user.keyboard('{ArrowLeft}{Enter}');

    expect(
      screen.getByRole('tabpanel', { name: 'label.export' })
    ).toBeVisible();
    expect(screen.getByRole('radio', { name: /label.json-ld/ })).toBeChecked();
  });

  it('resets the native import panel on a tab change and closes from the header', async () => {
    const onClose = jest.fn();
    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleaseExportModal
          canImport
          ontology={ontology}
          onClose={onClose}
        />
      </MemoryRouter>
    );
    await screen.findByTestId('ontology-release-export-preview');
    fireEvent.click(screen.getByRole('tab', { name: 'label.import' }));
    const input = document.querySelector('input[type="file"]');
    if (!input) {
      throw new Error('Missing file input');
    }
    const file = new File([''], 'too-large.ttl');
    Object.defineProperty(file, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'message.file-size-exceeded'
    );

    fireEvent.click(screen.getByRole('tab', { name: 'label.export' }));
    fireEvent.click(screen.getByRole('tab', { name: 'label.import' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('ontology-native-import-file')
    ).not.toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'label.close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('explains why export is unavailable when the ontology has no active release', async () => {
    mockGetOntologyState.mockResolvedValue({
      activationRevision: 1,
      lastReleaseRevision: 0,
      ontologyId: ontology.id,
      workingRevision: 0,
    });

    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleaseExportModal ontology={ontology} onClose={jest.fn()} />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('message.no-active-ontology-release')
    ).toBeVisible();
    expect(screen.getByTestId('ontology-run-release-export')).toBeDisabled();
    expect(mockGetOntologyRelease).not.toHaveBeenCalled();
    expect(mockExportOntologyRelease).not.toHaveBeenCalled();
  });

  it('keeps the modal open and permits retry after loading fails', async () => {
    mockGetOntologyState.mockRejectedValueOnce(new Error('temporarily down'));

    renderWithQueryClient(
      <MemoryRouter>
        <OntologyReleaseExportModal ontology={ontology} onClose={jest.fn()} />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('message.ontology-review-unavailable')
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));

    expect(await screen.findByText(/Release 1/)).toBeVisible();
    expect(mockGetOntologyState).toHaveBeenCalledTimes(2);
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

    it('offers the four formats and previews SKOS and SKOS-XL as written', async () => {
      await renderModal();
      for (const card of ['rdfxml', 'skos', 'jsonld', 'csv']) {
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
  if (action === 'Export tab') {
    await user.click(screen.getByRole('tab', { name: 'label.export' }));
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
    <OntologyReleaseExportModal
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

describe('OntologyReleaseExportModal import lifetime', () => {
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
    'Export tab',
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
      await screen.findByTestId('ontology-release-export-preview');
      await user.click(screen.getByRole('tab', { name: 'label.import' }));
      const input = document.querySelector('input[type="file"]');
      if (!input) {
        throw new Error('Missing file input');
      }
      const file = new File(['<urn:Customer> a <urn:Class> .'], 'sales.nt');
      Object.defineProperty(file, 'text', {
        value: jest.fn().mockResolvedValue('<urn:Customer> a <urn:Class> .'),
      });
      fireEvent.change(input, { target: { files: [file] } });
      await user.click(
        await screen.findByTestId('ontology-native-import-parse')
      );
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
      await screen.findByTestId('ontology-release-export-preview');
      await user.click(screen.getByRole('tab', { name: 'label.import' }));
      const input = document.querySelector('input[type="file"]');
      if (!input) {
        throw new Error('Missing file input');
      }
      const file = new File(['<urn:Customer> a <urn:Class> .'], 'sales.nt');
      Object.defineProperty(file, 'text', {
        value: jest.fn().mockResolvedValue('<urn:Customer> a <urn:Class> .'),
      });
      fireEvent.change(input, { target: { files: [file] } });
      await user.click(
        await screen.findByTestId('ontology-native-import-parse')
      );
      await screen.findByTestId('ontology-native-import-result');
      await user.click(screen.getByTestId('ontology-native-import-apply'));
      await screen.findByRole('alert');

      expect(
        screen.getByRole('tab', { name: 'label.export' })
      ).not.toHaveAttribute('aria-disabled', 'true');
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

  it.each(['header close', 'Escape', 'outside click'])(
    'allows %s to dismiss an idle modal',
    async (action) => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onClose = jest.fn();
      renderWithQueryClient(
        <MemoryRouter>
          <ImportModalOwner onApplied={jest.fn()} onClose={onClose} />
        </MemoryRouter>
      );
      await screen.findByTestId('ontology-release-export-preview');

      await dismissImportModal(action, user);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
  );
});
