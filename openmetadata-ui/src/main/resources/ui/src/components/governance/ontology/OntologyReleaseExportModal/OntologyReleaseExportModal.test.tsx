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
import { useState } from 'react';
import {
  OperationState,
  OperationType,
} from '../../../../generated/api/data/createOntologyChangeSet';
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
  exportOntologyRelease,
  getOntologyChangeSet,
  getOntologyRelease,
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
  previewNativeOntologyImport: jest.fn(),
  releaseOntologyEditLock: jest.fn(),
  exportOntologyRelease: jest.fn(),
  getOntologyRelease: jest.fn(),
  getOntologyState: jest.fn(),
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
const mockGetOntologyState = getOntologyState as jest.MockedFunction<
  typeof getOntologyState
>;
const mockDownloadFile = downloadFile as jest.MockedFunction<
  typeof downloadFile
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

  it('previews and exports the active immutable release in the selected format', async () => {
    const onClose = jest.fn();
    renderWithQueryClient(
      <OntologyReleaseExportModal ontology={ontology} onClose={onClose} />
    );

    expect(await screen.findByText(/Release 1/)).toBeVisible();
    expect(
      screen.getByRole('dialog', { name: 'label.import-export-ontology' })
    ).toBeVisible();
    expect(screen.getByText('Sales')).toBeVisible();
    expect(
      await screen.findByTestId('ontology-release-export-preview')
    ).toHaveTextContent('<rdf>sealed release</rdf>');

    fireEvent.click(screen.getByTestId('ontology-release-format-turtle'));

    await waitFor(() =>
      expect(mockExportOntologyRelease).toHaveBeenLastCalledWith(
        release.id,
        'turtle',
        expect.any(AbortSignal)
      )
    );
    const exportButton = screen.getByTestId('ontology-run-release-export');
    await waitFor(() => expect(exportButton).toBeEnabled());
    fireEvent.click(exportButton);

    expect(mockDownloadFile).toHaveBeenCalledWith(
      '<rdf>sealed release</rdf>',
      'Sales-release-1.ttl',
      'text/turtle'
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('supports keyboard tab navigation and keeps the selected format and import permission', async () => {
    const user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
    });
    renderWithQueryClient(
      <OntologyReleaseExportModal ontology={ontology} onClose={jest.fn()} />
    );
    await screen.findByTestId('ontology-release-export-preview');
    await user.click(screen.getByRole('radio', { name: /label.turtle/ }));
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
    expect(screen.getByTestId('ontology-native-import-file')).toBeDisabled();
    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
    expect(
      screen.queryByTestId('ontology-run-release-export')
    ).not.toBeInTheDocument();

    await user.keyboard('{ArrowLeft}{Enter}');

    expect(
      screen.getByRole('tabpanel', { name: 'label.export' })
    ).toBeVisible();
    expect(screen.getByRole('radio', { name: /label.turtle/ })).toBeChecked();
  });

  it('resets the native import panel on a tab change and closes from the header', async () => {
    const onClose = jest.fn();
    renderWithQueryClient(
      <OntologyReleaseExportModal
        canImport
        ontology={ontology}
        onClose={onClose}
      />
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

    expect(await screen.findByText('too-large.ttl')).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'label.export' }));
    fireEvent.click(screen.getByRole('tab', { name: 'label.import' }));

    expect(screen.queryByText('too-large.ttl')).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-native-import-file')).toBeEnabled();

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
      <OntologyReleaseExportModal ontology={ontology} onClose={jest.fn()} />
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
      <OntologyReleaseExportModal ontology={ontology} onClose={jest.fn()} />
    );

    expect(
      await screen.findByText('message.ontology-review-unavailable')
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));

    expect(await screen.findByText(/Release 1/)).toBeVisible();
    expect(mockGetOntologyState).toHaveBeenCalledTimes(2);
  });
});

const importPlan = {
  baseWorkingRevision: 7,
  name: 'native-import-one',
  ontology: 'Sales',
  operations: [
    {
      id: 'operation-id',
      operationType: OperationType.UpsertConcept,
      state: OperationState.Active,
    },
  ],
};
const importDraft: OntologyChangeSet = {
  ...importPlan,
  id: 'draft-id',
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
    await user.click(screen.getByRole('tab', { name: 'label.import' }));
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
    jest.mocked(getOntologyState).mockResolvedValue({
      activationRevision: 1,
      activeReleaseId: release.id,
      lastReleaseRevision: 1,
      ontologyId: ontology.id,
      workingRevision: 7,
    });
    jest.mocked(getOntologyRelease).mockResolvedValue(release);
    jest
      .mocked(exportOntologyRelease)
      .mockResolvedValue('<rdf>sealed release</rdf>');
    jest.mocked(previewNativeOntologyImport).mockResolvedValue(importPlan);
    jest.mocked(getOntologyChangeSet).mockResolvedValue(importDraft);
    jest.mocked(applyOntologyChangeSet).mockResolvedValue({
      ...importDraft,
      state: OntologyChangeSetState.Applied,
    });
    jest
      .mocked(acquireOntologyEditLock)
      .mockImplementation(async (request) => ({
        ...request,
        version: 2,
        acquiredAt: 1,
        renewedAt: 1,
        expiresAt: 60001,
        holder: { id: 'author', type: 'user' },
      }));
    jest.mocked(releaseOntologyEditLock).mockResolvedValue(undefined);
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
      jest.mocked(createOntologyChangeSet).mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
      );
      renderWithQueryClient(
        <ImportModalOwner onApplied={onApplied} onClose={onClose} />
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
      await screen.findByTestId('ontology-native-import-preview');
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

  it.each(['header close', 'Escape', 'outside click'])(
    'allows %s to dismiss an idle modal',
    async (action) => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onClose = jest.fn();
      renderWithQueryClient(
        <ImportModalOwner onApplied={jest.fn()} onClose={onClose} />
      );
      await screen.findByTestId('ontology-release-export-preview');

      await dismissImportModal(action, user);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }
  );
});
