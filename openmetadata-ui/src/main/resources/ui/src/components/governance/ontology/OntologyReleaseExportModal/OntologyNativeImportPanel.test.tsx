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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  OperationState,
  OperationType,
} from '../../../../generated/api/data/createOntologyChangeSet';
import { Format } from '../../../../generated/api/data/previewNativeOntologyImport';
import { OntologyChangeSetState } from '../../../../generated/entity/data/ontologyChangeSet';
import {
  applyOntologyChangeSet,
  createOntologyChangeSet,
  getOntologyChangeSet,
  previewNativeOntologyImport,
} from '../../../../rest/ontologyAPI';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import { useOntologyEditLease } from '../../../OntologyExplorer/hooks/useOntologyEditLease';
import OntologyNativeImportPanel from './OntologyNativeImportPanel';

jest.mock('../../../../rest/ontologyAPI', () => ({
  applyOntologyChangeSet: jest.fn(),
  createOntologyChangeSet: jest.fn(),
  getOntologyChangeSet: jest.fn(),
  previewNativeOntologyImport: jest.fn(),
}));
jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));
jest.mock('../../../OntologyExplorer/hooks/useOntologyEditLease', () => ({
  useOntologyEditLease: jest.fn(),
}));

const ontology = {
  id: 'ontology-id',
  name: 'Sales',
  fullyQualifiedName: 'Sales',
  iri: 'urn:sales',
  namespace: 'urn:sales:',
};
const preview = {
  baseWorkingRevision: 4,
  description: 'Import',
  displayName: 'Import',
  name: 'import',
  ontology: 'Sales',
  operations: [
    {
      id: 'operation-id',
      operationType: OperationType.UpsertConcept,
      state: OperationState.Active,
    },
  ],
};

const upload = async () => {
  const input = document.querySelector('input[type="file"]');
  if (!input) {
    throw new Error('Missing file input');
  }
  const file = new File(['<urn:Customer> a <urn:Class> .'], 'sales.nt', {
    type: 'application/n-triples',
  });
  Object.defineProperty(file, 'text', {
    value: jest.fn().mockResolvedValue('<urn:Customer> a <urn:Class> .'),
  });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByTestId('ontology-native-import-preview');
};

describe('OntologyNativeImportPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useOntologyEditLease as jest.Mock).mockImplementation(
      ({ resourceId }) => ({
        isOwned: Boolean(resourceId),
        lock: resourceId ? { sessionId: 'session-id', version: 2 } : undefined,
      })
    );
    (previewNativeOntologyImport as jest.Mock).mockResolvedValue(preview);
    (createOntologyChangeSet as jest.Mock).mockResolvedValue({
      id: 'draft-id',
    });
    (getOntologyChangeSet as jest.Mock).mockResolvedValue({
      id: 'draft-id',
      state: OntologyChangeSetState.ApplyFailed,
    });
    (applyOntologyChangeSet as jest.Mock).mockResolvedValue({
      state: OntologyChangeSetState.Applied,
    });
  });

  it('previews an RDF file and applies the retained draft under its lease', async () => {
    const onApplied = jest.fn();
    render(
      <OntologyNativeImportPanel
        canImport
        ontology={ontology}
        onApplied={onApplied}
      />
    );
    await upload();

    expect(previewNativeOntologyImport).toHaveBeenCalledWith('ontology-id', {
      format: Format.Ntriples,
      data: '<urn:Customer> a <urn:Class> .',
    });
    expect(createOntologyChangeSet).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('ontology-native-import-apply'));

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

    expect(createOntologyChangeSet).toHaveBeenCalledTimes(1);
    expect(applyOntologyChangeSet).toHaveBeenCalledWith('draft-id', {
      lease: { sessionId: 'session-id', version: 2 },
    });
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it('skips draft creation for a no-op preview', async () => {
    (previewNativeOntologyImport as jest.Mock).mockResolvedValue({
      ...preview,
      operations: [],
    });
    render(
      <OntologyNativeImportPanel
        canImport
        ontology={ontology}
        onApplied={jest.fn()}
      />
    );
    const input = document.querySelector('input[type="file"]');
    if (!input) {
      throw new Error('Missing file input');
    }
    const file = new File([''], 'sales.ttl');
    Object.defineProperty(file, 'text', {
      value: jest.fn().mockResolvedValue(''),
    });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('label.no-changes-to-save')).toBeVisible();
    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
    expect(createOntologyChangeSet).not.toHaveBeenCalled();
  });

  it('rejects an oversized file before reading or sending it', async () => {
    render(
      <OntologyNativeImportPanel
        canImport
        ontology={ontology}
        onApplied={jest.fn()}
      />
    );
    await upload();
    const input = document.querySelector('input[type="file"]');
    if (!input) {
      throw new Error('Missing file input');
    }
    const file = new File([''], 'large.ttl');
    const read = jest.fn();
    Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 + 1 });
    Object.defineProperty(file, 'text', { value: read });
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'message.file-size-exceeded'
    );
    expect(read).not.toHaveBeenCalled();
    expect(previewNativeOntologyImport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ontology-native-import-apply')).toBeDisabled();
  });

  it('checks the same draft before retrying an uncertain apply response', async () => {
    (applyOntologyChangeSet as jest.Mock)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ state: OntologyChangeSetState.Applied });
    const onApplied = jest.fn();
    render(
      <OntologyNativeImportPanel
        canImport
        ontology={ontology}
        onApplied={onApplied}
      />
    );
    await upload();
    fireEvent.click(screen.getByTestId('ontology-native-import-apply'));

    await waitFor(() => expect(getOntologyChangeSet).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('ontology-native-import-apply'));

    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1));

    expect(createOntologyChangeSet).toHaveBeenCalledTimes(1);
    expect(getOntologyChangeSet).toHaveBeenCalledTimes(2);
    expect(applyOntologyChangeSet).toHaveBeenCalledTimes(2);
  });
});
