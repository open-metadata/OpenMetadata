/*
 *  Copyright 2025 Collate.
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

import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { importGlossaryOntology } from '../../../rest/importExportAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ImportOntologyModal from './ImportOntologyModal.component';

jest.mock('../../../rest/importExportAPI', () => ({
  importGlossaryOntology: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options
        ? `${key} ${Object.entries(options)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')}`
        : key,
  }),
}));

const mockImport = importGlossaryOntology as jest.Mock;

const VALID_RESULT = {
  dryRun: true,
  glossariesCreated: 0,
  termsCreated: 3,
  termsUpdated: 0,
  relationsAdded: 1,
  conceptMappingsAdded: 1,
  customPropertiesCreated: 1,
  relationTypesRegistered: 1,
  messages: [],
};

const ISSUE_RESULT = {
  ...VALID_RESULT,
  termsCreated: 0,
  messages: ['Failed http://x#A: boom'],
};

const renderModal = (props: Record<string, unknown> = {}) =>
  render(
    <ImportOntologyModal
      open
      glossaryName="hcp"
      onCancel={jest.fn()}
      onSuccess={jest.fn()}
      {...props}
    />
  );

const uploadFile = async (name = 'hcp.ttl') => {
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  const file = new File(['@prefix x: <http://x#> .'], name, {
    type: 'text/turtle',
  });

  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
};

describe('ImportOntologyModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the dropzone with import disabled initially', () => {
    renderModal();

    expect(screen.getByTestId('upload-ontology-dragger')).toBeInTheDocument();
    expect(screen.getByTestId('import-ontology-submit')).toBeDisabled();
  });

  it('should dry-run validate on upload and enable import for a valid file', async () => {
    mockImport.mockResolvedValueOnce(VALID_RESULT);
    renderModal();

    await uploadFile();

    await waitFor(() =>
      expect(mockImport).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'hcp', dryRun: true, format: 'turtle' })
      )
    );

    expect(
      await screen.findByTestId('ontology-validation-summary')
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByTestId('import-ontology-submit')).not.toBeDisabled()
    );
  });

  it('should detect the RDF format from the file extension', async () => {
    mockImport.mockResolvedValueOnce(VALID_RESULT);
    renderModal();

    await uploadFile('ontology.rdf');

    await waitFor(() =>
      expect(mockImport).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'rdfxml' })
      )
    );
  });

  it('should list validation issues and keep import disabled when no terms result', async () => {
    mockImport.mockResolvedValueOnce(ISSUE_RESULT);
    renderModal();

    await uploadFile();

    expect(
      await screen.findByTestId('ontology-validation-issues')
    ).toBeInTheDocument();
    expect(screen.getByText('Failed http://x#A: boom')).toBeInTheDocument();
    expect(screen.getByTestId('import-ontology-submit')).toBeDisabled();
  });

  it('should commit with dryRun=false and report success on import', async () => {
    mockImport
      .mockResolvedValueOnce(VALID_RESULT)
      .mockResolvedValueOnce({ ...VALID_RESULT, dryRun: false });
    const onSuccess = jest.fn();
    renderModal({ onSuccess });

    await uploadFile();
    await waitFor(() =>
      expect(screen.getByTestId('import-ontology-submit')).not.toBeDisabled()
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('import-ontology-submit'));
    });

    await waitFor(() =>
      expect(mockImport).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: 'hcp', dryRun: false })
      )
    );

    expect(showSuccessToast).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
  });

  it('should call onCancel when cancel is clicked', () => {
    const onCancel = jest.fn();
    renderModal({ onCancel });

    fireEvent.click(screen.getByTestId('cancel-button'));

    expect(onCancel).toHaveBeenCalled();
  });

  describe('use cases', () => {
    it('should display the uploaded file name', async () => {
      mockImport.mockResolvedValueOnce(VALID_RESULT);
      renderModal();

      await uploadFile('HCP-Ontology.ttl');

      expect(await screen.findByTestId('ontology-file-name')).toHaveTextContent(
        'HCP-Ontology.ttl'
      );
    });

    it('should show the validation summary counts', async () => {
      mockImport.mockResolvedValueOnce(VALID_RESULT);
      renderModal();

      await uploadFile();

      const summary = await screen.findByTestId('ontology-validation-summary');

      expect(summary).toHaveTextContent('terms=3');
      expect(summary).toHaveTextContent('relations=1');
      expect(summary).toHaveTextContent('mappings=1');
      expect(summary).toHaveTextContent('properties=1');
    });

    it('should enable import when a re-import only updates existing terms', async () => {
      mockImport.mockResolvedValueOnce({
        ...VALID_RESULT,
        termsCreated: 0,
        termsUpdated: 3,
      });
      renderModal();

      await uploadFile();

      await waitFor(() =>
        expect(screen.getByTestId('import-ontology-submit')).not.toBeDisabled()
      );
    });

    it.each([
      ['ttl', 'turtle'],
      ['rdf', 'rdfxml'],
      ['owl', 'rdfxml'],
      ['xml', 'rdfxml'],
      ['nt', 'ntriples'],
      ['jsonld', 'jsonld'],
      ['json', 'jsonld'],
      ['unknown', 'turtle'],
    ])(
      'should map a .%s file to the %s format',
      async (ext, expectedFormat) => {
        mockImport.mockResolvedValueOnce(VALID_RESULT);
        renderModal();

        await uploadFile(`ontology.${ext}`);

        await waitFor(() =>
          expect(mockImport).toHaveBeenCalledWith(
            expect.objectContaining({ format: expectedFormat })
          )
        );
      }
    );
  });

  describe('failure scenarios', () => {
    it('should show an error and keep import disabled when validation fails', async () => {
      mockImport.mockRejectedValueOnce(new Error('invalid rdf'));
      renderModal();

      await uploadFile();

      await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

      expect(
        screen.queryByTestId('ontology-validation-summary')
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('import-ontology-submit')).toBeDisabled();
    });

    it('should show an error and keep the modal open when the commit fails', async () => {
      mockImport
        .mockResolvedValueOnce(VALID_RESULT)
        .mockRejectedValueOnce(new Error('commit failed'));
      const onSuccess = jest.fn();
      const onCancel = jest.fn();
      renderModal({ onSuccess, onCancel });

      await uploadFile();
      await waitFor(() =>
        expect(screen.getByTestId('import-ontology-submit')).not.toBeDisabled()
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('import-ontology-submit'));
      });

      await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

      expect(onSuccess).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('should keep import disabled when the ontology yields no terms', async () => {
      mockImport.mockResolvedValueOnce({
        ...VALID_RESULT,
        termsCreated: 0,
        termsUpdated: 0,
        messages: [],
      });
      renderModal();

      await uploadFile();

      expect(
        await screen.findByTestId('ontology-validation-summary')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('ontology-validation-issues')
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('import-ontology-submit')).toBeDisabled();
    });

    it('should show an error when the file cannot be read', async () => {
      const OriginalFileReader = global.FileReader;

      class FailingFileReader {
        onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;
        onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
        readAsText() {
          this.onerror?.({} as ProgressEvent<FileReader>);
        }
      }
      global.FileReader = FailingFileReader as unknown as typeof FileReader;
      renderModal();

      await uploadFile();

      expect(showErrorToast).toHaveBeenCalled();
      expect(mockImport).not.toHaveBeenCalled();

      global.FileReader = OriginalFileReader;
    });

    it('should not call the API when no file is selected', async () => {
      renderModal();
      const input = document.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [] } });
      });

      expect(mockImport).not.toHaveBeenCalled();
    });

    it('should show the validating state while the dry run is in flight', async () => {
      let resolveValidation: (value: unknown) => void = () => undefined;
      mockImport.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveValidation = resolve;
        })
      );
      renderModal();

      await uploadFile();

      expect(
        await screen.findByTestId('ontology-validating')
      ).toBeInTheDocument();

      await act(async () => {
        resolveValidation(VALID_RESULT);
      });
    });
  });
});
