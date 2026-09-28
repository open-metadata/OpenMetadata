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
import { Glossary } from '../../generated/entity/data/glossary';
import { exportGlossaryInCSVFormat } from '../../rest/glossaryAPI';
import { importGlossaryOntology } from '../../rest/importExportAPI';
import {
  exportGlossaryAsOntology,
  validateOntologyShapes,
} from '../../rest/rdfAPI';
import OntologyImportExportModal from './OntologyImportExportModal';

jest.mock('../../rest/rdfAPI', () => ({
  exportGlossaryAsOntology: jest.fn().mockResolvedValue({
    text: () => Promise.resolve('@prefix : <urn:om:> .'),
  }),
  validateOntologyShapes: jest
    .fn()
    .mockResolvedValue({ conforms: true, report: '' }),
}));

jest.mock('../../rest/glossaryAPI', () => ({
  exportGlossaryInCSVFormat: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../rest/importExportAPI', () => ({
  importGlossaryOntology: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showInfoToast: jest.fn(),
  showSuccessToast: jest.fn(),
  showWarningToast: jest.fn(),
}));

const first = { id: 'g1', name: 'FIBO' } as Glossary;
const second = { id: 'g2', name: 'FIBO Loans' } as Glossary;

const DRY_RUN_RESULT = {
  conceptMappingsAdded: 64,
  customPropertiesCreated: 0,
  dryRun: true,
  glossariesCreated: 0,
  messages: ['skip a', 'skip b', 'skip c'],
  relationTypesRegistered: 0,
  relationsAdded: 210,
  termsCreated: 142,
  termsUpdated: 0,
};

const renderModal = (
  props: Partial<Parameters<typeof OntologyImportExportModal>[0]> = {}
) =>
  render(
    <OntologyImportExportModal
      glossaries={[first, second]}
      isAdminUser={false}
      relationCount="7"
      termCount="20"
      onClose={jest.fn()}
      {...props}
    />
  );

const uploadOntologyFile = (name = 'ontology.ttl') => {
  const file = new File(['@prefix : <urn:om:> .'], name, {
    type: 'text/turtle',
  });
  fireEvent.change(screen.getByTestId('ontology-import-input'), {
    target: { files: [file] },
  });
};

describe('OntologyImportExportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.URL.createObjectURL = jest.fn(() => 'blob:mock');
    globalThis.URL.revokeObjectURL = jest.fn();
    (importGlossaryOntology as jest.Mock).mockResolvedValue(DRY_RUN_RESULT);
  });

  it('exports the selected glossary in the chosen format', async () => {
    renderModal({ glossary: first });

    fireEvent.click(await screen.findByTestId('ontology-run-export'));

    await waitFor(() =>
      expect(exportGlossaryAsOntology).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'rdfxml', glossaryId: 'g1' })
      )
    );
  });

  it('aggregates every glossary when scope is all glossaries', async () => {
    renderModal();

    fireEvent.click(await screen.findByTestId('ontology-run-export'));

    await waitFor(() =>
      expect(exportGlossaryAsOntology).toHaveBeenCalledWith(
        expect.objectContaining({ glossaryId: 'g2' })
      )
    );
  });

  it('switches format when another radio card is chosen', async () => {
    renderModal({ glossary: first });

    fireEvent.click(await screen.findByTestId('ontology-format-turtle'));
    fireEvent.click(screen.getByTestId('ontology-run-export'));

    await waitFor(() =>
      expect(exportGlossaryAsOntology).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'turtle', glossaryId: 'g1' })
      )
    );
  });

  it('starts the async CSV export when the CSV format is chosen', async () => {
    renderModal({ glossary: first });

    fireEvent.click(await screen.findByTestId('ontology-format-csv'));
    fireEvent.click(screen.getByTestId('ontology-run-export'));

    await waitFor(() =>
      expect(exportGlossaryInCSVFormat).toHaveBeenCalledWith('FIBO')
    );
  });

  it('runs SHACL validation and shows the result for an admin', async () => {
    renderModal({ glossary: first, isAdminUser: true });

    fireEvent.click(await screen.findByTestId('ontology-run-shacl'));

    await waitFor(() => expect(validateOntologyShapes).toHaveBeenCalled());

    expect(
      await screen.findByTestId('ontology-shacl-status')
    ).toBeInTheDocument();
  });

  it('still exports when SHACL validation fails for an admin', async () => {
    (validateOntologyShapes as jest.Mock).mockRejectedValueOnce(
      new Error('validation service down')
    );
    renderModal({ glossary: first, isAdminUser: true });

    fireEvent.click(await screen.findByTestId('ontology-run-export'));

    await waitFor(() => expect(exportGlossaryAsOntology).toHaveBeenCalled());
  });

  it('does not run SHACL validation for a non-admin', async () => {
    renderModal({ glossary: first });

    fireEvent.click(await screen.findByTestId('ontology-run-shacl'));

    expect(validateOntologyShapes).not.toHaveBeenCalled();
  });

  it('parses an uploaded ontology file as a dry-run and shows the preview', async () => {
    renderModal({ glossary: first });

    fireEvent.click(await screen.findByTestId('ontology-transfer-tab-import'));
    uploadOntologyFile();

    fireEvent.click(await screen.findByText('ontology.ttl'));
    fireEvent.click(screen.getByTestId('ontology-parse-dry-run'));

    await waitFor(() =>
      expect(importGlossaryOntology).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: true,
          format: 'turtle',
          name: 'FIBO',
        })
      )
    );

    expect(
      await screen.findByTestId('ontology-import-stat-terms')
    ).toHaveTextContent('142');
    expect(
      screen.getByTestId('ontology-import-stat-skipped')
    ).toHaveTextContent('3');
  });

  it('imports for real after a successful dry-run', async () => {
    renderModal({ glossary: first });

    fireEvent.click(await screen.findByTestId('ontology-transfer-tab-import'));
    uploadOntologyFile();
    fireEvent.click(await screen.findByText('ontology.ttl'));
    fireEvent.click(screen.getByTestId('ontology-parse-dry-run'));

    fireEvent.click(await screen.findByTestId('ontology-run-import'));

    await waitFor(() =>
      expect(importGlossaryOntology).toHaveBeenLastCalledWith(
        expect.objectContaining({ dryRun: false, name: 'FIBO' })
      )
    );
  });

  it('parses into the inline target picker on the all-glossaries scope', async () => {
    renderModal();

    fireEvent.click(await screen.findByTestId('ontology-transfer-tab-import'));

    expect(
      screen.getByTestId('ontology-import-target-select')
    ).toBeInTheDocument();

    uploadOntologyFile();
    fireEvent.click(await screen.findByText('ontology.ttl'));
    fireEvent.click(screen.getByTestId('ontology-parse-dry-run'));

    await waitFor(() =>
      expect(importGlossaryOntology).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: true, name: 'FIBO' })
      )
    );
  });

  it('renders the in-modal glossary scope selector', async () => {
    renderModal();

    expect(
      await screen.findByTestId('ontology-scope-select')
    ).toBeInTheDocument();
  });
});
