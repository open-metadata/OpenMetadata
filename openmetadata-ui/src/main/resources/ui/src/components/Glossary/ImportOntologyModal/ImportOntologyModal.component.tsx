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
import { InboxOutlined } from '@ant-design/icons';
import { Alert, Button, List, Modal, Space, Typography, Upload } from 'antd';
import { RcFile } from 'antd/lib/upload';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  importGlossaryOntology,
  OntologyImportResult,
} from '../../../rest/importExportAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

interface ImportOntologyModalProps {
  glossaryName: string;
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const looksLikeRdfXml = (content: string): boolean => {
  const head = content.trimStart();

  return (
    head.startsWith('<?xml') ||
    head.startsWith('<rdf:RDF') ||
    head.startsWith('<RDF')
  );
};

const getOntologyFormat = (fileName: string, content: string): string => {
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
  const [format, setFormat] = useState<string>('turtle');
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
    async (content: string, ontologyFormat: string) => {
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

  const handleBeforeUpload = useCallback(
    (file: RcFile) => {
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

      return false;
    },
    [t, validate]
  );

  const handleImport = useCallback(async () => {
    setIsImporting(true);
    try {
      await importGlossaryOntology({
        name: glossaryName,
        data: fileContent,
        dryRun: false,
        format,
      });
      showSuccessToast(t('message.ontology-imported-successfully'));
      onSuccess();
      handleCancel();
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
    <Modal
      destroyOnClose
      data-testid="import-ontology-modal"
      footer={[
        <Button data-testid="cancel-button" key="cancel" onClick={handleCancel}>
          {t('label.cancel')}
        </Button>,
        <Button
          data-testid="import-ontology-submit"
          disabled={!hasMaterializedTerms}
          key="import"
          loading={isImporting}
          type="primary"
          onClick={handleImport}>
          {t('label.import')}
        </Button>,
      ]}
      open={open}
      title={t('label.import-ontology')}
      onCancel={handleCancel}>
      <Space className="w-full" direction="vertical" size="middle">
        <Typography.Text type="secondary">
          {t('message.import-ontology-help')}
        </Typography.Text>

        <Upload.Dragger
          accept=".ttl,.rdf,.owl,.nt,.xml"
          beforeUpload={handleBeforeUpload}
          data-testid="upload-ontology-dragger"
          maxCount={1}
          showUploadList={false}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t('message.upload-ontology-file')}</p>
          {fileName && (
            <Typography.Text strong data-testid="ontology-file-name">
              {fileName}
            </Typography.Text>
          )}
        </Upload.Dragger>

        {isValidating && (
          <Typography.Text data-testid="ontology-validating">
            {t('label.validating-ellipsis')}
          </Typography.Text>
        )}

        {!isUndefined(validation) && (
          <Space className="w-full" direction="vertical" size="small">
            <Alert
              showIcon
              data-testid="ontology-validation-summary"
              message={t('message.ontology-import-summary', {
                terms: validation.termsCreated + validation.termsUpdated,
                relations: validation.relationsAdded,
                mappings: validation.conceptMappingsAdded,
                properties: validation.customPropertiesCreated,
              })}
              type={hasMaterializedTerms ? 'success' : 'warning'}
            />

            {validation.messages.length > 0 && (
              <List
                bordered
                data-testid="ontology-validation-issues"
                dataSource={validation.messages}
                header={t('message.ontology-import-issues-count', {
                  count: validation.messages.length,
                })}
                renderItem={(message) => (
                  <List.Item>
                    <Typography.Text type="danger">{message}</Typography.Text>
                  </List.Item>
                )}
                size="small"
              />
            )}
          </Space>
        )}
      </Space>
    </Modal>
  );
};

export default ImportOntologyModal;
