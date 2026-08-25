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
import {
  Alert,
  Button,
  Dialog,
  FileUploadDropZone,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  importGlossaryOntology,
  OntologyImportFormat,
  OntologyImportResult,
} from '../../../rest/importExportAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { ImportOntologyModalProps } from './ImportOntologyModal.interface';

const looksLikeRdfXml = (content: string): boolean => {
  const head = content.trimStart();

  return (
    head.startsWith('<?xml') ||
    head.startsWith('<rdf:RDF') ||
    head.startsWith('<RDF')
  );
};

const getOntologyFormat = (
  fileName: string,
  content: string
): OntologyImportFormat => {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'rdf':
    case 'xml':
      return 'rdfxml';
    case 'owl':
      // .owl is not tied to one serialization: classic OWL is RDF/XML, but most
      // modern OWL 2 files are Turtle. Detect from the content instead of guessing.
      return looksLikeRdfXml(content) ? 'rdfxml' : 'turtle';
    case 'nt':
      return 'ntriples';
    default:
      return 'turtle';
  }
};

const ImportOntologyModal = ({
  glossaryName,
  open,
  onCancel,
  onSuccess,
}: ImportOntologyModalProps) => {
  const { t } = useTranslation();
  const [fileName, setFileName] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [format, setFormat] = useState<OntologyImportFormat>('turtle');
  const [validation, setValidation] = useState<OntologyImportResult>();
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  const resetState = useCallback(() => {
    setFileName('');
    setFileContent('');
    setValidation(undefined);
    setIsValidating(false);
    setIsImporting(false);
  }, []);

  const handleCancel = useCallback(() => {
    resetState();
    onCancel();
  }, [onCancel, resetState]);

  const validate = useCallback(
    async (content: string, ontologyFormat: OntologyImportFormat) => {
      setIsValidating(true);
      try {
        const result = await importGlossaryOntology({
          name: glossaryName,
          data: content,
          dryRun: true,
          format: ontologyFormat,
        });
        setValidation(result);
      } catch (error) {
        setValidation(undefined);
        showErrorToast(error as AxiosError);
      } finally {
        setIsValidating(false);
      }
    },
    [glossaryName]
  );

  const handleDropFiles = useCallback(
    (files: FileList) => {
      const file = files[0];

      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = (event.target?.result as string) ?? '';
        const ontologyFormat = getOntologyFormat(file.name, content);
        setFileName(file.name);
        setFileContent(content);
        setFormat(ontologyFormat);
        validate(content, ontologyFormat);
      };
      reader.onerror = () => {
        showErrorToast(t('server.unexpected-error'));
      };
      reader.readAsText(file);
    },
    [t, validate]
  );

  const handleUnsupportedFile = useCallback(() => {
    showErrorToast(
      t('message.invalid-file-format', {
        formats: '.ttl, .rdf, .owl, .nt, .xml',
      })
    );
  }, [t]);

  const handleImport = useCallback(async () => {
    setIsImporting(true);
    try {
      const result = await importGlossaryOntology({
        name: glossaryName,
        data: fileContent,
        dryRun: false,
        format,
      });
      onSuccess();
      if (result.messages.length > 0) {
        // Surface failures the dry-run did not catch (e.g. a concurrent write
        // conflict) instead of a blanket success toast, and keep the modal open
        // so the user can review which terms or relations were skipped.
        setValidation(result);
      } else {
        showSuccessToast(t('message.ontology-imported-successfully'));
        handleCancel();
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsImporting(false);
    }
  }, [fileContent, format, glossaryName, handleCancel, onSuccess, t]);

  const hasMaterializedTerms =
    !isUndefined(validation) &&
    validation.termsCreated + validation.termsUpdated > 0;

  return (
    <ModalOverlay
      isDismissable={!isImporting}
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && !isImporting && handleCancel()}>
      <Modal>
        <Dialog
          showCloseButton
          title={t('label.import-ontology')}
          width={640}
          onClose={handleCancel}>
          <Dialog.Content>
            <div
              className="tw:flex tw:flex-col tw:gap-4 tw:pb-2"
              data-testid="import-ontology-modal">
              <Typography className="tw:text-secondary" size="text-sm">
                {t('message.import-ontology-help')}
              </Typography>

              {/* Wrap the dropzone so the test id lands on a visible element and
                  scopes the hidden <input type="file"> for upload automation. */}
              <div data-testid="upload-ontology-dragger">
                <FileUploadDropZone
                  accept=".ttl,.rdf,.owl,.nt,.xml"
                  allowsMultiple={false}
                  clickToUploadLabel={t('label.click-to-upload')}
                  hint={t('message.upload-ontology-file')}
                  input-data-testid="upload-ontology-input"
                  orDragAndDropLabel={t('label.or-drag-and-drop')}
                  // Block extensions outside `accept` (e.g. .jsonld/.json, which the backend
                  // rejects) at the drop boundary instead of reading them and surfacing a
                  // server-side parse error.
                  onDropFiles={handleDropFiles}
                  onDropUnacceptedFiles={handleUnsupportedFile}
                />
              </div>

              {fileName && (
                <Typography
                  className="tw:text-secondary"
                  data-testid="ontology-file-name"
                  size="text-sm"
                  weight="medium">
                  {fileName}
                </Typography>
              )}

              {isValidating && (
                <Typography
                  className="tw:text-secondary"
                  data-testid="ontology-validating"
                  size="text-sm">
                  {t('label.validating-ellipsis')}
                </Typography>
              )}

              {!isUndefined(validation) && (
                <div className="tw:flex tw:flex-col tw:gap-2">
                  <Alert
                    data-testid="ontology-validation-summary"
                    title={t('message.ontology-import-summary', {
                      terms: validation.termsCreated + validation.termsUpdated,
                      relations: validation.relationsAdded,
                      mappings: validation.conceptMappingsAdded,
                      properties: validation.customPropertiesCreated,
                    })}
                    variant={hasMaterializedTerms ? 'success' : 'warning'}
                  />

                  {validation.messages.length > 0 && (
                    <div
                      className="tw:flex tw:flex-col tw:gap-1 tw:rounded-lg tw:border tw:border-secondary tw:p-3"
                      data-testid="ontology-validation-issues">
                      <Typography
                        className="tw:text-secondary"
                        size="text-sm"
                        weight="medium">
                        {t('message.ontology-import-issues-count', {
                          count: validation.messages.length,
                        })}
                      </Typography>
                      <ul className="tw:flex tw:flex-col tw:gap-1 tw:pl-4">
                        {validation.messages.map((message) => (
                          <li className="tw:list-disc" key={message}>
                            <Typography
                              className="tw:text-error-primary"
                              size="text-sm">
                              {message}
                            </Typography>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Dialog.Content>

          <Dialog.Footer>
            <Button
              color="secondary"
              data-testid="cancel-button"
              isDisabled={isImporting}
              size="sm"
              onPress={handleCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="import-ontology-submit"
              isDisabled={!hasMaterializedTerms}
              isLoading={isImporting}
              size="sm"
              onPress={handleImport}>
              {t('label.import')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ImportOntologyModal;
