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
  CheckCircleFilled,
  CloseCircleFilled,
  CloseOutlined,
  FileTextOutlined,
  LoadingOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { Modal, Radio, Space, Typography, Upload } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { load as yamlLoad } from 'js-yaml';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ImportIcon } from '../../../assets/svg/ic-import.svg';
import { CreateDataContract } from '../../../generated/api/data/createDataContract';
import { DataContract } from '../../../generated/entity/data/dataContract';
import {
  createContract,
  createOrUpdateContractFromODCSYaml,
  deleteContractById,
  importContractFromODCSYaml,
  SchemaValidation,
  updateContract,
  validateODCSYaml,
} from '../../../rest/contractAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import {
  ContractImportModalProps,
  ImportMode,
  ParsedODCSContract,
  ParsedOpenMetadataContract,
} from './ODCSImportModal.interface';
import './ODCSImportModal.less';

const { Dragger } = Upload;
const { Text } = Typography;

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
  const [isValidating, setIsValidating] = useState(false);
  const [serverValidation, setServerValidation] =
    useState<SchemaValidation | null>(null);
  const [serverValidationError, setServerValidationError] = useState<
    string | null
  >(null);

  const isODCSFormat = format === 'odcs';

  useEffect(() => {
    if (!yamlContent || !isODCSFormat || parseError) {
      setServerValidation(null);
      setServerValidationError(null);

      return;
    }

    const validateContract = async () => {
      setIsValidating(true);
      setServerValidationError(null);
      try {
        const validation = await validateODCSYaml(
          yamlContent,
          entityId,
          entityType
        );
        setServerValidation(validation);
      } catch (err) {
        const error = err as AxiosError<{ message?: string }>;
        const message =
          error.response?.data?.message ?? error.message ?? String(err);
        setServerValidationError(message);
        setServerValidation(null);
      } finally {
        setIsValidating(false);
      }
    };

    validateContract();
  }, [yamlContent, isODCSFormat, entityId, entityType, parseError]);

  const hasValidationErrors = useMemo(() => {
    if (serverValidationError) {
      return true;
    }
    if (serverValidation?.failed && serverValidation.failed > 0) {
      return true;
    }

    return false;
  }, [serverValidation, serverValidationError]);

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

    if (hasExistingContract) {
      return createOrUpdateContractFromODCSYaml(
        yamlContent,
        entityId,
        entityType,
        importMode
      );
    }

    return importContractFromODCSYaml(yamlContent, entityId, entityType);
  }, [yamlContent, hasExistingContract, importMode, entityId, entityType]);

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
    setServerValidation(null);
    setServerValidationError(null);
    onClose();
  }, [onClose]);

  const handleRemoveFile = useCallback(() => {
    setYamlContent(null);
    setParsedRawContent(null);
    setFileName('');
    setParsedContract(null);
    setParseError(null);
    setServerValidation(null);
    setServerValidationError(null);
  }, []);

  const renderContractPreview = useCallback(() => {
    if (!parsedContract) {
      return null;
    }

    const includedFeatures: string[] = [];

    if (isODCSFormat) {
      const odcsContract = parsedContract as ParsedODCSContract;
      if (odcsContract.hasSchema) {
        includedFeatures.push(t('label.schema'));
      }
      if (odcsContract.hasSla) {
        includedFeatures.push(t('label.sla'));
      }
      if (odcsContract.hasSecurity) {
        includedFeatures.push(t('label.security'));
      }
      if (odcsContract.hasTeam) {
        includedFeatures.push(t('label.team'));
      }

      return (
        <div className="contract-preview-card">
          <div className="preview-header">{t('label.contract-preview')}</div>
          <div className="preview-row">
            <span className="preview-label">{t('label.name')}</span>
            <span className="preview-value">
              {odcsContract.name ?? t('label.not-specified')}
            </span>
          </div>
          <div className="preview-row">
            <span className="preview-label">{t('label.version')}</span>
            <span className="preview-value">{odcsContract.version}</span>
          </div>
          <div className="preview-row">
            <span className="preview-label">{t('label.status')}</span>
            <span className="preview-value">{odcsContract.status}</span>
          </div>
          {includedFeatures.length > 0 && (
            <div className="preview-tags">
              {includedFeatures.map((feature) => (
                <span className="preview-tag" key={feature}>
                  {feature}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }

    const omContract = parsedContract as ParsedOpenMetadataContract;
    if (omContract.hasSchema) {
      includedFeatures.push(t('label.schema'));
    }
    if (omContract.hasSla) {
      includedFeatures.push(t('label.sla'));
    }
    if (omContract.hasSecurity) {
      includedFeatures.push(t('label.security'));
    }
    if (omContract.hasSemantics) {
      includedFeatures.push(t('label.semantic-plural'));
    }

    return (
      <div className="contract-preview-card">
        <div className="preview-header">{t('label.contract-preview')}</div>
        <div className="preview-row">
          <span className="preview-label">{t('label.name')}</span>
          <span className="preview-value">
            {omContract.name ?? t('label.not-specified')}
          </span>
        </div>
        {omContract.displayName && (
          <div className="preview-row">
            <span className="preview-label">{t('label.display-name')}</span>
            <span className="preview-value">{omContract.displayName}</span>
          </div>
        )}
        {includedFeatures.length > 0 && (
          <div className="preview-tags">
            {includedFeatures.map((feature) => (
              <span className="preview-tag" key={feature}>
                {feature}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }, [parsedContract, isODCSFormat, t]);

  const renderValidationPanel = useCallback(() => {
    if (!yamlContent) {
      return (
        <div className="empty-validation">
          <FileTextOutlined className="empty-icon" />
          <Text type="secondary">{t('message.upload-file-to-validate')}</Text>
        </div>
      );
    }

    if (parseError) {
      return (
        <>
          <div className="validation-panel-header">
            <CloseCircleFilled className="validation-icon validation-icon-error" />
            <span className="validation-title validation-title-error">
              {t('label.parse-error')}
            </span>
          </div>
          <div className="validation-content">
            <Text type="danger">{parseError}</Text>
          </div>
          <div className="validation-summary">
            <div className="summary-item error">
              <CloseCircleFilled className="summary-icon" />
              <span>
                {t('label.syntax')}: {t('label.invalid')}
              </span>
            </div>
          </div>
        </>
      );
    }

    if (isValidating) {
      return (
        <>
          <div className="validation-panel-header">
            <LoadingOutlined className="validation-icon validation-icon-loading" />
            <span className="validation-title">
              {t('label.validating-ellipsis')}
            </span>
          </div>
          <div className="validation-content">
            <Text type="secondary">
              {t('message.validating-contract-schema')}
            </Text>
          </div>
        </>
      );
    }

    if (serverValidationError) {
      return (
        <>
          <div className="validation-panel-header">
            <CloseCircleFilled className="validation-icon validation-icon-error" />
            <span className="validation-title validation-title-error">
              {t('label.validation-failed')}
            </span>
          </div>
          <div className="validation-content">
            <Text type="danger">{serverValidationError}</Text>
          </div>
          <div className="validation-summary">
            <div className="summary-item success">
              <CheckCircleFilled className="summary-icon" />
              <span>
                {t('label.syntax')}: {t('label.valid')}
              </span>
            </div>
            <div className="summary-item error">
              <CloseCircleFilled className="summary-icon" />
              <span>
                {t('label.schema')}: {t('label.error')}
              </span>
            </div>
          </div>
        </>
      );
    }

    if (serverValidation?.failed !== undefined && serverValidation.failed > 0) {
      return (
        <>
          <div className="validation-panel-header">
            <CloseCircleFilled className="validation-icon validation-icon-error" />
            <span className="validation-title validation-title-error">
              {t('message.schema-validation-warning')}
            </span>
          </div>
          <div className="validation-content">
            <Text>
              {t('message.schema-fields-not-found-in-entity', {
                count: serverValidation.failed,
              })}
            </Text>
            <div className="failed-fields-list">
              {serverValidation.failedFields?.map((field, index) => (
                <div className="failed-field-item" key={index}>
                  <span className="field-dot" />
                  <span className="field-name">{field}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="validation-summary">
            <div className="summary-item success">
              <CheckCircleFilled className="summary-icon" />
              <span>
                {t('label.syntax')}: {t('label.valid')}
              </span>
            </div>
            <div className="summary-item error">
              <CloseCircleFilled className="summary-icon" />
              <span>
                {t('label.schema')}: {serverValidation.failed}{' '}
                {t('label.field-plural-lowercase')}{' '}
                {t('label.not-found-lowercase')}
              </span>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="validation-panel-header">
          <CheckCircleFilled className="validation-icon validation-icon-success" />
          <span className="validation-title validation-title-success">
            {t('label.validation-passed')}
          </span>
        </div>
        <div className="validation-content">
          <Text type="success">
            {serverValidation?.total && serverValidation.total > 0
              ? t('message.schema-validation-passed', {
                  count: serverValidation.passed,
                })
              : t('message.contract-syntax-valid')}
          </Text>
        </div>
        <div className="validation-summary">
          <div className="summary-item success">
            <CheckCircleFilled className="summary-icon" />
            <span>
              {t('label.syntax')}: {t('label.valid')}
            </span>
          </div>
          {serverValidation?.total !== undefined && serverValidation.total > 0 && (
            <div className="summary-item success">
              <CheckCircleFilled className="summary-icon" />
              <span>
                {t('label.schema')}: {serverValidation.passed}{' '}
                {t('label.field-plural-lowercase')} {t('label.verified')}
              </span>
            </div>
          )}
        </div>
      </>
    );
  }, [
    yamlContent,
    parseError,
    isValidating,
    serverValidationError,
    serverValidation,
    t,
  ]);

  const renderImportOptions = useCallback(() => {
    if (!hasExistingContract) {
      return null;
    }

    return (
      <div className="import-options-section">
        <div className="existing-contract-warning">
          <WarningFilled className="warning-icon" />
          <span>{t('message.existing-contract-detected')}</span>
        </div>

        <Radio.Group
          className="w-full"
          value={importMode}
          onChange={(e) => setImportMode(e.target.value)}>
          <Space className="w-full" direction="vertical" size={0}>
            <div
              className={`import-mode-option ${
                importMode === 'merge' ? 'selected' : ''
              }`}
              onClick={() => setImportMode('merge')}>
              <Radio value="merge">
                <span className="option-title">
                  {t('label.merge-with-existing')}
                </span>
              </Radio>
              <p className="option-description">
                {t('message.import-mode-merge-description')}
              </p>
            </div>
            <div
              className={`import-mode-option ${
                importMode === 'replace' ? 'selected' : ''
              }`}
              onClick={() => setImportMode('replace')}>
              <Radio value="replace">
                <span className="option-title">
                  {t('label.replace-existing')}
                </span>
              </Radio>
              <p className="option-description">
                {t('message.import-mode-replace-description')}
              </p>
            </div>
          </Space>
        </Radio.Group>
      </div>
    );
  }, [hasExistingContract, importMode, t]);

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
      className="odcs-import-modal"
      closable={!isLoading}
      maskClosable={!isLoading}
      okButtonProps={{
        disabled:
          !yamlContent ||
          Boolean(parseError) ||
          isValidating ||
          hasValidationErrors,
        loading: isLoading || isValidating,
      }}
      okText={t('label.import')}
      open={visible}
      title={modalTitle}
      width={900}
      onCancel={handleReset}
      onOk={handleImport}>
      <div className="import-content-wrapper">
        <div className="source-panel">
          {!yamlContent ? (
            <div className="dragger-wrapper">
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
            </div>
          ) : (
            <>
              <div className="file-info-card">
                <div className="file-info">
                  <FileTextOutlined className="file-icon" />
                  <span className="file-name">{fileName}</span>
                </div>
                <CloseOutlined
                  className="remove-button"
                  onClick={handleRemoveFile}
                />
              </div>

              {renderContractPreview()}
              {renderImportOptions()}
            </>
          )}
        </div>

        <div className="validation-panel">{renderValidationPanel()}</div>
      </div>
    </Modal>
  );
};

export default ContractImportModal;
