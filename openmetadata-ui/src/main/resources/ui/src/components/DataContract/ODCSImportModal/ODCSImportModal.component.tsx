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

import { Alert, Modal, Radio, Space, Typography, Upload } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { load as yamlLoad } from 'js-yaml';
import { isEmpty } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ImportIcon } from '../../../assets/svg/ic-import.svg';
import { CreateDataContract } from '../../../generated/api/data/createDataContract';
import { DataContract } from '../../../generated/entity/data/dataContract';
import {
  createContract,
  createOrUpdateContractFromODCSYaml,
  deleteContractById,
  importContractFromODCSYaml,
  updateContract,
} from '../../../rest/contractAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  ContractImportModalProps,
  ImportMode,
  ParsedODCSContract,
  ParsedOpenMetadataContract,
} from './ODCSImportModal.interface';

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;

type ParsedContract = ParsedODCSContract | ParsedOpenMetadataContract;

const ContractImportModal: React.FC<ContractImportModalProps> = ({
  visible,
  entityId,
  entityType,
  format,
  existingContract,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [yamlContent, setYamlContent] = useState<string | null>(null);
  const [parsedRawContent, setParsedRawContent] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedContract, setParsedContract] = useState<ParsedContract | null>(
    null
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [isLoading, setIsLoading] = useState(false);

  const isODCSFormat = format === 'odcs';

  const hasExistingContract = useMemo(
    () => Boolean(existingContract?.id),
    [existingContract]
  );

  const parseODCSContent = useCallback(
    (parsed: Record<string, unknown>): ParsedODCSContract | null => {
      if (!parsed.apiVersion || !parsed.kind || !parsed.status) {
        return null;
      }

      const description = parsed.description as
        | Record<string, string>
        | undefined;

      return {
        name: parsed.name as string | undefined,
        version: (parsed.version as string) ?? '1.0.0',
        status: parsed.status as string,
        description: description?.purpose,
        hasSchema: Array.isArray(parsed.schema) && parsed.schema.length > 0,
        hasSla:
          Array.isArray(parsed.slaProperties) &&
          parsed.slaProperties.length > 0,
        hasSecurity: Array.isArray(parsed.roles) && parsed.roles.length > 0,
        hasTeam: Array.isArray(parsed.team) && parsed.team.length > 0,
      };
    },
    []
  );

  const parseOpenMetadataContent = useCallback(
    (parsed: Record<string, unknown>): ParsedOpenMetadataContract | null => {
      if (!parsed.entity) {
        return null;
      }

      return {
        name: parsed.name as string | undefined,
        displayName: parsed.displayName as string | undefined,
        description: parsed.description as string | undefined,
        hasSchema: Array.isArray(parsed.schema) && parsed.schema.length > 0,
        hasSla: !isEmpty(parsed.sla),
        hasSecurity: !isEmpty(parsed.security),
        hasSemantics:
          Array.isArray(parsed.semantics) && parsed.semantics.length > 0,
      };
    },
    []
  );

  const parseYamlContent = useCallback(
    (content: string): ParsedContract | null => {
      try {
        const parsed = yamlLoad(content) as Record<string, unknown>;
        setParsedRawContent(parsed);

        if (isODCSFormat) {
          return parseODCSContent(parsed);
        }

        return parseOpenMetadataContent(parsed);
      } catch {
        return null;
      }
    },
    [isODCSFormat, parseODCSContent, parseOpenMetadataContent]
  );

  const handleFileUpload = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setYamlContent(content);
        setFileName(file.name);

        const parsed = parseYamlContent(content);
        if (parsed) {
          setParsedContract(parsed);
          setParseError(null);
        } else {
          setParsedContract(null);
          setParseError(
            isODCSFormat
              ? t('message.invalid-odcs-contract-format')
              : t('message.invalid-openmetadata-contract-format')
          );
        }
      };
      reader.readAsText(file);

      return false;
    },
    [parseYamlContent, isODCSFormat, t]
  );

  const handleODCSImport = useCallback(async (): Promise<DataContract> => {
    if (!yamlContent) {
      throw new Error('No content to import');
    }

    if (hasExistingContract && importMode === 'replace') {
      await deleteContractById(existingContract!.id!);

      return importContractFromODCSYaml(yamlContent, entityId, entityType);
    } else if (hasExistingContract && importMode === 'merge') {
      return createOrUpdateContractFromODCSYaml(
        yamlContent,
        entityId,
        entityType
      );
    }

    return importContractFromODCSYaml(yamlContent, entityId, entityType);
  }, [
    yamlContent,
    hasExistingContract,
    importMode,
    existingContract,
    entityId,
    entityType,
  ]);

  const handleOpenMetadataImport =
    useCallback(async (): Promise<DataContract> => {
      if (!parsedRawContent) {
        throw new Error('No content to import');
      }

      const contractData = {
        ...parsedRawContent,
        entity: {
          id: entityId,
          type: entityType,
        },
      } as CreateDataContract;

      if (hasExistingContract && importMode === 'replace') {
        await deleteContractById(existingContract!.id!);

        return createContract(contractData) as Promise<DataContract>;
      } else if (hasExistingContract && importMode === 'merge') {
        const patchOperations = compare(existingContract as object, {
          ...existingContract,
          ...contractData,
        });

        return updateContract(
          existingContract!.id!,
          patchOperations
        ) as Promise<DataContract>;
      }

      return createContract(contractData) as Promise<DataContract>;
    }, [
      parsedRawContent,
      hasExistingContract,
      importMode,
      existingContract,
      entityId,
      entityType,
    ]);

  const handleImport = useCallback(async () => {
    if (!yamlContent) {
      return;
    }

    setIsLoading(true);

    try {
      const result = isODCSFormat
        ? await handleODCSImport()
        : await handleOpenMetadataImport();

      showSuccessToast(
        t('message.entity-imported-successfully', {
          entity: isODCSFormat ? t('label.odcs-contract') : t('label.contract'),
        })
      );
      onSuccess(result);
      handleReset();
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [
    yamlContent,
    isODCSFormat,
    handleODCSImport,
    handleOpenMetadataImport,
    onSuccess,
    t,
  ]);

  const handleReset = useCallback(() => {
    setYamlContent(null);
    setParsedRawContent(null);
    setFileName('');
    setParsedContract(null);
    setParseError(null);
    setImportMode('merge');
    onClose();
  }, [onClose]);

  const mergeDescription = useMemo(() => {
    if (!hasExistingContract) {
      return null;
    }

    return (
      <div className="m-t-md">
        <Text strong>{t('label.what-will-happen')}:</Text>
        <ul className="m-t-xs m-l-md">
          <li>{t('message.import-odcs-merge-preserve-id')}</li>
          <li>{t('message.import-odcs-merge-update-fields')}</li>
          <li>{t('message.import-odcs-merge-preserve-reviewers')}</li>
          <li>{t('message.import-odcs-merge-deep-merge-sla')}</li>
        </ul>
      </div>
    );
  }, [hasExistingContract, t]);

  const replaceDescription = useMemo(() => {
    if (!hasExistingContract) {
      return null;
    }

    return (
      <div className="m-t-md">
        <Text strong>{t('label.what-will-happen')}:</Text>
        <ul className="m-t-xs m-l-md">
          <li>{t('message.import-odcs-replace-delete-existing')}</li>
          <li>{t('message.import-odcs-replace-create-new')}</li>
          <li>{t('message.import-odcs-replace-lose-history')}</li>
        </ul>
      </div>
    );
  }, [hasExistingContract, t]);

  const renderContractPreview = useCallback(() => {
    if (!parsedContract) {
      return null;
    }

    if (isODCSFormat) {
      const odcsContract = parsedContract as ParsedODCSContract;

      return (
        <div className="bg-grey-1 p-md rounded-4">
          <Text strong>{t('label.contract-preview')}:</Text>
          <div className="m-t-sm">
            <Space direction="vertical" size="small">
              <Text>
                {t('label.name')}:{' '}
                {odcsContract.name ?? t('label.not-specified')}
              </Text>
              <Text>
                {t('label.version')}: {odcsContract.version}
              </Text>
              <Text>
                {t('label.status')}: {odcsContract.status}
              </Text>
              <Text>
                {t('label.includes')}:{' '}
                {[
                  odcsContract.hasSchema && t('label.schema'),
                  odcsContract.hasSla && t('label.sla'),
                  odcsContract.hasSecurity && t('label.security'),
                  odcsContract.hasTeam && t('label.team'),
                ]
                  .filter(Boolean)
                  .join(', ') || t('label.none')}
              </Text>
            </Space>
          </div>
        </div>
      );
    }

    const omContract = parsedContract as ParsedOpenMetadataContract;

    return (
      <div className="bg-grey-1 p-md rounded-4">
        <Text strong>{t('label.contract-preview')}:</Text>
        <div className="m-t-sm">
          <Space direction="vertical" size="small">
            <Text>
              {t('label.name')}: {omContract.name ?? t('label.not-specified')}
            </Text>
            {omContract.displayName && (
              <Text>
                {t('label.display-name')}: {omContract.displayName}
              </Text>
            )}
            <Text>
              {t('label.includes')}:{' '}
              {[
                omContract.hasSchema && t('label.schema'),
                omContract.hasSla && t('label.sla'),
                omContract.hasSecurity && t('label.security'),
                omContract.hasSemantics && t('label.semantic-plural'),
              ]
                .filter(Boolean)
                .join(', ') || t('label.none')}
            </Text>
          </Space>
        </div>
      </div>
    );
  }, [parsedContract, isODCSFormat, t]);

  const modalTitle = isODCSFormat
    ? t('label.import-odcs-contract')
    : t('label.import-contract');

  const dragDropMessage = isODCSFormat
    ? t('message.drag-drop-odcs-file')
    : t('message.drag-drop-openmetadata-file');

  return (
    <Modal
      centered
      destroyOnClose
      cancelText={t('label.cancel')}
      closable={!isLoading}
      maskClosable={!isLoading}
      okButtonProps={{
        disabled: !yamlContent || Boolean(parseError),
        loading: isLoading,
      }}
      okText={t('label.import')}
      open={visible}
      title={modalTitle}
      width={600}
      onCancel={handleReset}
      onOk={handleImport}>
      <Space className="w-full" direction="vertical" size="middle">
        {!yamlContent ? (
          <Dragger
            accept=".yaml,.yml,.json"
            beforeUpload={handleFileUpload}
            multiple={false}
            showUploadList={false}>
            <p className="ant-upload-drag-icon">
              <ImportIcon height={48} width={48} />
            </p>
            <p className="ant-upload-text">{dragDropMessage}</p>
            <p className="ant-upload-hint">
              {t('message.supports-yaml-format')}
            </p>
          </Dragger>
        ) : (
          <>
            <Alert
              message={
                <Space>
                  <Text>{t('label.file')}:</Text>
                  <Text strong>{fileName}</Text>
                </Space>
              }
              type="success"
            />

            {parseError && <Alert message={parseError} type="error" />}

            {renderContractPreview()}

            {hasExistingContract && (
              <div className="m-t-md">
                <Alert
                  className="m-b-md"
                  message={t('message.existing-contract-detected')}
                  type="warning"
                />

                <Paragraph>{t('message.choose-import-mode')}:</Paragraph>

                <Radio.Group
                  className="w-full"
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value)}>
                  <Space className="w-full" direction="vertical">
                    <Radio value="merge">
                      <Text strong>{t('label.merge-with-existing')}</Text>
                      <Paragraph className="m-l-lg text-grey-muted m-b-0">
                        {t('message.import-mode-merge-description')}
                      </Paragraph>
                    </Radio>
                    <Radio value="replace">
                      <Text strong>{t('label.replace-existing')}</Text>
                      <Paragraph className="m-l-lg text-grey-muted m-b-0">
                        {t('message.import-mode-replace-description')}
                      </Paragraph>
                    </Radio>
                  </Space>
                </Radio.Group>

                {importMode === 'merge' && mergeDescription}
                {importMode === 'replace' && replaceDescription}
              </div>
            )}
          </>
        )}
      </Space>
    </Modal>
  );
};

export default ContractImportModal;
