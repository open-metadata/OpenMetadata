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
  Badge,
  Button,
  Dialog,
  Dot,
  Modal,
  ModalOverlay,
  RadioButton,
  RadioGroup,
  Select,
  SelectItem,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertTriangle,
  CheckCircle,
  CheckVerified01,
  File06,
  Trash01,
  XCircle,
  XClose,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { load as yamlLoad } from 'js-yaml';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloudUpload } from '../../../assets/svg/upload-cloud.svg';
import { CreateDataContract } from '../../../generated/api/data/createDataContract';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { ContractValidation } from '../../../generated/entity/datacontract/contractValidation';
import {
  createContract,
  createOrUpdateContractFromODCSYaml,
  deleteContractById,
  importContractFromODCSYaml,
  ODCSParseResult,
  parseODCSYaml,
  updateContract,
  validateContractYaml,
  validateODCSYaml,
} from '../../../rest/contractAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import {
  ContractImportModalProps,
  ImportMode,
  ParsedODCSContract,
  ParsedOpenMetadataContract,
} from './ODCSImportModal.interface';
import './ODCSImportModal.less';

type ParsedContract = ParsedODCSContract | ParsedOpenMetadataContract;

const ContractImportModal: React.FC<ContractImportModalProps> = ({
  visible,
  entityId,
  entityType,
  entityName,
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
    useState<ContractValidation | null>(null);
  const [serverValidationError, setServerValidationError] = useState<
    string | null
  >(null);
  const [schemaObjects, setSchemaObjects] = useState<string[]>([]);
  const [selectedObjectName, setSelectedObjectName] = useState<string>('');
  const [hasMultipleObjects, setHasMultipleObjects] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const isODCSFormat = format === 'odcs';

  useEffect(() => {
    if (!yamlContent || parseError) {
      setServerValidation(null);
      setServerValidationError(null);

      return;
    }

    if (isODCSFormat && hasMultipleObjects && !selectedObjectName) {
      setServerValidation(null);
      setServerValidationError(null);

      return;
    }

    const runValidation = async () => {
      setIsValidating(true);
      setServerValidationError(null);
      try {
        let validation: ContractValidation;
        if (isODCSFormat) {
          validation = await validateODCSYaml(
            yamlContent,
            entityId,
            entityType,
            selectedObjectName || undefined
          );
        } else {
          validation = await validateContractYaml(yamlContent);
        }
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

    runValidation();
  }, [
    yamlContent,
    isODCSFormat,
    entityId,
    entityType,
    parseError,
    hasMultipleObjects,
    selectedObjectName,
  ]);

  const hasValidationErrors = useMemo(() => {
    if (serverValidationError) {
      return true;
    }
    if (serverValidation && !serverValidation.valid) {
      return true;
    }
    if (
      serverValidation?.entityErrors &&
      serverValidation.entityErrors.length > 0
    ) {
      return true;
    }
    if (
      serverValidation?.constraintErrors &&
      serverValidation.constraintErrors.length > 0
    ) {
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
      if (!parsed.name) {
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

  const processFile = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        setYamlContent(content);
        setFileName(file.name);

        const parsed = parseYamlContent(content);
        if (parsed) {
          setParsedContract(parsed);
          setParseError(null);

          if (isODCSFormat) {
            try {
              const parseResult: ODCSParseResult = await parseODCSYaml(content);
              const objects = parseResult.schemaObjects ?? [];
              setSchemaObjects(objects);
              setHasMultipleObjects(parseResult.hasMultipleObjects ?? false);

              if (objects.length === 1) {
                setSelectedObjectName(objects[0]);
              } else if (objects.length > 1) {
                const matchingObject = entityName
                  ? objects.find(
                      (obj) => obj.toLowerCase() === entityName.toLowerCase()
                    )
                  : undefined;
                setSelectedObjectName(matchingObject ?? '');
              }
            } catch {
              setSchemaObjects([]);
              setHasMultipleObjects(false);
              setSelectedObjectName('');
            }
          }
        } else {
          setParsedContract(null);
          setParseError(
            isODCSFormat
              ? t('message.invalid-odcs-contract-format')
              : t('message.invalid-openmetadata-contract-format')
          );
          setSchemaObjects([]);
          setHasMultipleObjects(false);
          setSelectedObjectName('');
        }
      };
      reader.readAsText(file);
    },
    [parseYamlContent, isODCSFormat, entityName, t]
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);

      const file = event.dataTransfer.files?.[0];
      if (file) {
        const validExtensions = ['.yaml', '.yml', '.json'];
        const fileExtension = file.name
          .toLowerCase()
          .slice(file.name.lastIndexOf('.'));
        if (validExtensions.includes(fileExtension)) {
          processFile(file);
        }
      }
    },
    [processFile]
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
        importMode,
        selectedObjectName || undefined
      );
    }

    return importContractFromODCSYaml(
      yamlContent,
      entityId,
      entityType,
      selectedObjectName || undefined
    );
  }, [
    yamlContent,
    hasExistingContract,
    importMode,
    entityId,
    entityType,
    selectedObjectName,
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
        const mergedForPatch: Record<string, unknown> = {
          ...existingContract,
          ...contractData,
        };

        if (typeof mergedForPatch.termsOfUse === 'string') {
          mergedForPatch.termsOfUse = {
            ...(existingContract?.termsOfUse &&
            typeof existingContract.termsOfUse === 'object'
              ? existingContract.termsOfUse
              : {}),
            content: mergedForPatch.termsOfUse,
          };
        }

        const patchOperations = compare(
          existingContract as object,
          mergedForPatch
        );

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

  const handleReset = useCallback(() => {
    setYamlContent(null);
    setParsedRawContent(null);
    setFileName('');
    setParsedContract(null);
    setParseError(null);
    setImportMode('merge');
    setServerValidation(null);
    setServerValidationError(null);
    setSchemaObjects([]);
    setSelectedObjectName('');
    setHasMultipleObjects(false);
    onClose();
  }, [onClose]);

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

  const handleRemoveFile = useCallback(() => {
    setYamlContent(null);
    setParsedRawContent(null);
    setFileName('');
    setParsedContract(null);
    setParseError(null);
    setServerValidation(null);
    setServerValidationError(null);
    setSchemaObjects([]);
    setSelectedObjectName('');
    setHasMultipleObjects(false);
  }, []);

  const handleImportModeChange = useCallback((value: string) => {
    setImportMode(value as ImportMode);
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
        <div
          className="contract-preview-card"
          data-testid="contract-preview-card">
          <Typography as="p" className="preview-header">
            {t('label.contract-preview')}
          </Typography>
          <div className="preview-row">
            <Typography as="span" className="preview-label">
              {t('label.name')}
            </Typography>
            <Typography as="span" className="preview-value">
              {odcsContract.name ?? t('label.not-specified')}
            </Typography>
          </div>
          <div className="preview-row">
            <Typography as="span" className="preview-label">
              {t('label.version')}
            </Typography>
            <Typography as="span" className="preview-value">
              {odcsContract.version}
            </Typography>
          </div>
          <div className="preview-row">
            <Typography as="span" className="preview-label">
              {t('label.status')}
            </Typography>
            <Typography as="span" className="preview-value">
              {odcsContract.status}
            </Typography>
          </div>
          {includedFeatures.length > 0 && (
            <div className="preview-tags">
              {includedFeatures.map((feature) => (
                <Badge color="gray" key={feature} size="sm">
                  {feature}
                </Badge>
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
        <Typography as="p" className="preview-header">
          {t('label.contract-preview')}
        </Typography>
        <div className="preview-row">
          <Typography as="span" className="preview-label">
            {t('label.name')}
          </Typography>
          <Typography as="span" className="preview-value">
            {omContract.name ?? t('label.not-specified')}
          </Typography>
        </div>
        {omContract.displayName && (
          <div className="preview-row">
            <Typography as="span" className="preview-label">
              {t('label.display-name')}
            </Typography>
            <Typography as="span" className="preview-value">
              {omContract.displayName}
            </Typography>
          </div>
        )}
        {includedFeatures.length > 0 && (
          <div className="preview-tags">
            {includedFeatures.map((feature) => (
              <Badge color="gray" key={feature} size="sm">
                {feature}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }, [parsedContract, isODCSFormat, t]);

  const renderValidationPanel = useCallback(() => {
    if (parseError) {
      return (
        <div className="validation-panel-inner" data-testid="parse-error-panel">
          <div className="validation-panel-row tw:mb-4 tw:pb-4 tw:border-b tw:border-error-200">
            <Typography as="span" className="tw:text-sm tw:font-semibold">
              {t('label.parse-error')}
            </Typography>
            <Badge color="error" size="sm">
              <XCircle className="tw:size-3 tw:mr-1" />
              {t('label.failed')}
            </Badge>
          </div>
          <div className="tw:flex-1 tw:flex tw:flex-col tw:min-h-[200px] tw:gap-2">
            <Typography as="p" className="tw:text-sm tw:text-secondary tw:mb-4">
              {isODCSFormat
                ? t('message.invalid-odcs-contract-format-required-fields')
                : t(
                    'message.invalid-openmetadata-contract-format-required-fields'
                  )}
            </Typography>
            <div className="tw:flex tw:flex-col tw:gap-2">
              {(isODCSFormat ? ['APIVersion', 'Kind', 'Status'] : ['name']).map(
                (field) => (
                  <div className="tw:flex tw:items-center tw:gap-2" key={field}>
                    <Dot className="tw:size-2 tw:text-error-600 tw:flex-shrink-0" />
                    <Typography as="span" className="tw:text-sm">
                      {field}
                    </Typography>
                  </div>
                )
              )}
            </div>
          </div>
          <div className="validation-summary-row tw:mt-auto tw:pt-4 tw:border-t tw:border-error-200">
            <div className="tw:flex tw:items-center tw:gap-2">
              <XCircle className="tw:size-4 tw:text-error-600" />
              <Typography as="span" className="tw:text-sm">
                {t('label.syntax')} : <strong>{t('label.invalid')}</strong>
              </Typography>
            </div>
          </div>
        </div>
      );
    }

    if (isValidating) {
      return (
        <div className="validation-loading-panel">
          <Loader size="default" />
          <Typography as="p" className="tw:text-sm tw:text-secondary">
            {t('message.validating-contract-schema')}
          </Typography>
        </div>
      );
    }

    if (serverValidationError) {
      return (
        <div
          className="validation-panel-inner"
          data-testid="server-validation-error-panel">
          <div className="validation-panel-row tw:mb-4 tw:pb-4 tw:border-b tw:border-secondary">
            <Typography as="span" className="tw:text-sm tw:font-semibold">
              {t('label.schema-validation')}
            </Typography>
            <Badge color="error" size="sm">
              <XCircle className="tw:size-3 tw:mr-1" />
              {t('label.failed')}
            </Badge>
          </div>
          <div className="tw:flex-1 tw:min-h-[200px]">
            <Typography as="p" className="tw:text-sm tw:text-secondary">
              {serverValidationError}
            </Typography>
          </div>
          <div className="tw:mt-auto tw:pt-4 tw:border-t tw:border-secondary">
            <div className="tw:flex tw:items-center tw:gap-2 tw:mb-2">
              <CheckCircle className="tw:size-4 tw:text-success-500" />
              <Typography as="span" className="tw:text-sm">
                {t('label.syntax')} : <strong>{t('label.valid')}</strong>
              </Typography>
            </div>
            <div className="tw:flex tw:items-center tw:gap-2">
              <XCircle className="tw:size-4 tw:text-error-600" />
              <Typography as="span" className="tw:text-sm">
                {t('label.schema')} : <strong>{t('label.error')}</strong>
              </Typography>
            </div>
          </div>
        </div>
      );
    }

    if (
      serverValidation?.schemaValidation?.failed !== undefined &&
      serverValidation.schemaValidation.failed > 0
    ) {
      return (
        <div
          className="validation-panel-inner"
          data-testid="server-validation-failed-error-panel">
          <div className="validation-panel-row tw:mb-4 tw:pb-4 tw:border-b tw:border-secondary">
            <Typography as="span" className="tw:text-sm tw:font-semibold">
              {t('label.schema-validation')}
            </Typography>
            <Badge color="error" size="sm">
              <XCircle className="tw:size-3 tw:mr-1" />
              {t('label.failed')}
            </Badge>
          </div>
          <div className="tw:flex-1 tw:overflow-y-auto tw:min-h-[200px]">
            <div
              className="tw:flex tw:flex-col tw:gap-2"
              data-testid="failed-fields-list">
              {serverValidation.schemaValidation?.failedFields?.map(
                (field, index) => (
                  <div
                    className="tw:flex tw:items-center tw:gap-2"
                    key={`notfound-${index}`}>
                    <Dot className="tw:size-2 tw:text-error-600 tw:flex-shrink-0" />
                    <Typography
                      as="span"
                      className="tw:text-sm"
                      data-testid={`failed-field-${index}`}>
                      {field} - {t('label.not-found-lowercase')}
                    </Typography>
                  </div>
                )
              )}
              {serverValidation.schemaValidation?.duplicateFields?.map(
                (field, index) => (
                  <div
                    className="tw:flex tw:items-center tw:gap-2"
                    key={`duplicate-${index}`}>
                    <Dot className="tw:size-2 tw:text-error-600 tw:flex-shrink-0" />
                    <Typography
                      as="span"
                      className="tw:text-sm"
                      data-testid={`duplicate-field-${index}`}>
                      {field} - {t('label.duplicate')}
                    </Typography>
                  </div>
                )
              )}
              {serverValidation.schemaValidation?.typeMismatchFields?.map(
                (field, index) => (
                  <div
                    className="tw:flex tw:items-center tw:gap-2"
                    key={`typemismatch-${index}`}>
                    <Dot className="tw:size-2 tw:text-error-600 tw:flex-shrink-0" />
                    <Typography
                      as="span"
                      className="tw:text-sm"
                      data-testid={`type-mismatch-field-${index}`}>
                      {field}
                    </Typography>
                  </div>
                )
              )}
            </div>
          </div>
          <div className="tw:mt-auto tw:pt-4 tw:border-t tw:border-secondary">
            <div className="tw:flex tw:items-center tw:gap-2 tw:mb-2">
              <CheckCircle className="tw:size-4 tw:text-success-500" />
              <Typography as="span" className="tw:text-sm">
                {t('label.syntax')} : <strong>{t('label.valid')}</strong>
              </Typography>
            </div>
            <div className="tw:flex tw:items-center tw:gap-2">
              <XCircle className="tw:size-4 tw:text-error-600" />
              <Typography as="span" className="tw:text-sm">
                {t('label.schema')} :{' '}
                {serverValidation.schemaValidation?.failed}{' '}
                {t('label.field-plural-lowercase')} {t('label.with-issues')}
              </Typography>
            </div>
          </div>
        </div>
      );
    }

    const hasEntityErrors =
      serverValidation?.entityErrors &&
      serverValidation.entityErrors.length > 0;
    const hasConstraintErrors =
      serverValidation?.constraintErrors &&
      serverValidation.constraintErrors.length > 0;

    if (hasEntityErrors || hasConstraintErrors) {
      const allErrors = [
        ...(serverValidation?.entityErrors ?? []),
        ...(serverValidation?.constraintErrors ?? []),
      ];

      return (
        <div
          className="validation-panel-inner"
          data-testid="entity-validation-error-panel">
          <div className="validation-panel-row tw:mb-4 tw:pb-4 tw:border-b tw:border-secondary">
            <Typography as="span" className="tw:text-sm tw:font-semibold">
              {t('label.contract-validation')}
            </Typography>
            <Badge color="error" size="sm">
              <Dot className="tw:size-3 tw:mr-1" />
              {t('label.failed')}
            </Badge>
          </div>
          <div className="tw:flex-1 tw:min-h-[200px]">
            <div
              className="tw:flex tw:flex-col tw:gap-2"
              data-testid="entity-errors-list">
              {allErrors.map((error, index) => (
                <div className="tw:flex tw:items-start tw:gap-2" key={index}>
                  <Dot
                    className="tw:size-2 tw:text-error-600 tw:flex-shrink-0"
                    style={{ marginTop: 6 }}
                  />
                  <Typography
                    as="span"
                    className="tw:text-sm tw:break-words"
                    data-testid={`entity-error-${index}`}>
                    {error}
                  </Typography>
                </div>
              ))}
            </div>
          </div>
          <div className="tw:mt-auto tw:pt-4 tw:border-t tw:border-secondary">
            <div className="tw:flex tw:items-center tw:gap-2 tw:mb-2">
              <CheckCircle className="tw:size-4 tw:text-success-500" />
              <Typography as="span" className="tw:text-sm">
                {t('label.syntax')} : <strong>{t('label.valid')}</strong>
              </Typography>
            </div>
            <div className="tw:flex tw:items-center tw:gap-2">
              <Dot className="tw:size-4 tw:text-error-600" />
              <Typography as="span" className="tw:text-sm">
                {t('label.contract')} :{' '}
                <strong>{t('label.validation-failed')}</strong>
              </Typography>
            </div>
          </div>
        </div>
      );
    }

    const hasTypeMismatches =
      serverValidation?.schemaValidation?.typeMismatchFields &&
      serverValidation.schemaValidation.typeMismatchFields.length > 0;

    return (
      <div
        className="validation-panel-inner"
        data-testid="validation-success-panel">
        <div className="validation-panel-row tw:mb-4 tw:pb-4 tw:border-b tw:border-secondary">
          <Typography as="span" className="tw:text-sm tw:font-semibold">
            {t('label.schema-validation')}
          </Typography>
          <Badge color={hasTypeMismatches ? 'warning' : 'success'} size="sm">
            <CheckVerified01 className="tw:size-3 tw:mr-1" />
            {hasTypeMismatches
              ? t('label.passed-with-warnings')
              : t('label.passed')}
          </Badge>
        </div>
        <div className="tw:flex-1 tw:overflow-y-auto tw:min-h-[200px]">
          <Typography as="p" className="tw:text-sm tw:text-secondary">
            {serverValidation?.schemaValidation?.total &&
            serverValidation.schemaValidation.total > 0
              ? t('message.schema-validation-passed', {
                  count: serverValidation.schemaValidation?.passed,
                })
              : t('message.contract-syntax-valid')}
          </Typography>
          {hasTypeMismatches && (
            <div className="tw:mt-4">
              <Typography
                as="p"
                className="tw:text-sm tw:font-semibold tw:text-warning-700 tw:mb-2">
                {t('label.type-mismatches')}
              </Typography>
              <div
                className="tw:flex tw:flex-col tw:gap-2"
                data-testid="type-mismatch-warnings-list">
                {serverValidation?.schemaValidation?.typeMismatchFields?.map(
                  (field) => (
                    <div
                      className="tw:flex tw:items-center tw:gap-2"
                      key={field}>
                      <AlertTriangle className="tw:size-4 tw:text-warning-600" />
                      <Typography
                        as="span"
                        className="tw:text-sm"
                        data-testid={`type-mismatch-warning-${field}`}>
                        {field}
                      </Typography>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
        <div className="tw:mt-auto tw:pt-4 tw:border-t tw:border-secondary">
          <div className="tw:flex tw:items-center tw:gap-2 tw:mb-2">
            <CheckCircle className="tw:size-4 tw:text-success-700" />
            <Typography as="span" className="tw:text-sm">
              {t('label.syntax')} : <strong>{t('label.valid')}</strong>
            </Typography>
          </div>
          {serverValidation?.schemaValidation?.total !== undefined &&
            serverValidation.schemaValidation.total > 0 && (
              <div className="tw:flex tw:items-center tw:gap-2">
                <CheckCircle className="tw:size-4 tw:text-success-700" />
                <Typography as="span" className="tw:text-sm">
                  {t('label.schema')} :{' '}
                  {serverValidation.schemaValidation?.passed}{' '}
                  {t('label.field-plural-lowercase')} {t('label.verified')}
                </Typography>
              </div>
            )}
        </div>
      </div>
    );
  }, [
    parseError,
    isValidating,
    serverValidationError,
    serverValidation,
    t,
    isODCSFormat,
  ]);

  const renderImportOptions = useCallback(() => {
    if (!hasExistingContract) {
      return null;
    }

    return (
      <div className="tw:flex tw:flex-col tw:gap-3 tw:mt-4">
        <div
          className="existing-contract-warning"
          data-testid="existing-contract-warning">
          <AlertTriangle className="tw:size-5 tw:text-warning-600 tw:shrink-0 tw:mt-0.5" />
          <Typography
            as="span"
            className="tw:text-sm tw:text-warning-800 tw:leading-5">
            {t('message.existing-contract-detected')}{' '}
            <strong>{t('message.please-select-action-below')}</strong>
          </Typography>
        </div>

        <RadioGroup value={importMode} onChange={handleImportModeChange}>
          <div
            className={`import-mode-option${
              importMode === 'merge' ? ' selected' : ''
            }`}
            data-testid="import-mode-merge"
            onClick={() => setImportMode('merge')}>
            <div className="tw:flex tw:justify-between tw:items-start">
              <div>
                <Typography as="p" className="option-title">
                  {t('label.merge-with-existing')}
                </Typography>
                <Typography as="p" className="option-description">
                  {t('message.import-mode-merge-description')}
                </Typography>
              </div>
              <RadioButton value="merge" />
            </div>
          </div>
          <div
            className={`import-mode-option${
              importMode === 'replace' ? ' selected' : ''
            }`}
            data-testid="import-mode-replace"
            onClick={() => setImportMode('replace')}>
            <div className="tw:flex tw:justify-between tw:items-start">
              <div>
                <Typography as="p" className="option-title">
                  {t('label.replace-entire-contract')}
                </Typography>
                <Typography as="p" className="option-description">
                  {t('message.import-mode-replace-description')}
                </Typography>
              </div>
              <RadioButton value="replace" />
            </div>
          </div>
        </RadioGroup>
      </div>
    );
  }, [hasExistingContract, importMode, handleImportModeChange, t]);

  const renderObjectSelector = useCallback(() => {
    if (!isODCSFormat || schemaObjects.length <= 1) {
      return null;
    }

    return (
      <div className="object-selector-section">
        <div className="object-selector-header">
          <Typography
            as="span"
            className="tw:text-sm tw:font-semibold"
            data-testid="multi-object-contract-detected">
            {t('message.multi-object-contract-detected')}
          </Typography>
        </div>
        <div className="object-selector-content">
          <Select
            data-testid="schema-object-select"
            items={schemaObjects.map((obj) => ({ id: obj, label: obj }))}
            placeholder={t('label.select-schema-object')}
            selectedKey={selectedObjectName || null}
            onSelectionChange={(key) =>
              setSelectedObjectName(key ? String(key) : '')
            }>
            {(item) => (
              <SelectItem
                data-testid={`schema-object-option-${item.id}`}
                id={item.id}>
                {item.label}
              </SelectItem>
            )}
          </Select>
        </div>
      </div>
    );
  }, [isODCSFormat, schemaObjects, selectedObjectName, t]);

  const isImportDisabled =
    !yamlContent ||
    Boolean(parseError) ||
    isValidating ||
    hasValidationErrors ||
    (hasMultipleObjects && !selectedObjectName);

  return (
    <ModalOverlay
      isOpen={visible}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isLoading) {
          handleReset();
        }
      }}>
      <Modal
        className={`tw:rounded-xl tw:bg-white tw:max-h-[90vh]${
          yamlContent ? ' tw:max-w-[900px]' : ' tw:max-w-2xl'
        }`}>
        <Dialog className="tw:flex tw:flex-col tw:h-full">
          <div
            className="odcs-import-modal"
            data-testid="import-contract-modal">
            <div
              className={`modal-header${yamlContent ? ' with-shadow' : ''}`}
              data-testid="import-contract-modal-title">
              <div>
                <Typography
                  as="p"
                  className="tw:text-sm tw:font-semibold tw:leading-5">
                  {isODCSFormat
                    ? t('label.import-odcs-contract')
                    : t('label.import-contract')}
                </Typography>
                <Typography
                  as="p"
                  className="tw:text-sm tw:leading-5 tw:mt-1 tw:text-secondary">
                  {t('message.upload-file-description')}
                </Typography>
              </div>
              {!isLoading && (
                <Button
                  color="tertiary"
                  data-testid="modal-close-button"
                  iconLeading={XClose}
                  size="sm"
                  onPress={handleReset}
                />
              )}
            </div>

            <div className="modal-content-area">
              <div
                className={`import-content-wrapper${
                  yamlContent ? ' with-file' : ''
                }`}>
                <div className="source-panel">
                  {!yamlContent ? (
                    <div
                      className={`upload-dropzone${
                        isDragging ? ' dragging' : ''
                      }`}
                      data-testid="drop-zone"
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}>
                      <input
                        accept=".yaml,.yml"
                        data-testid="file-upload-input"
                        id="file-upload-input"
                        style={{ display: 'none' }}
                        type="file"
                        onChange={handleFileInputChange}
                      />
                      <label
                        className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:cursor-pointer tw:w-full"
                        htmlFor="file-upload-input">
                        <div className="upload-icon-wrapper">
                          <CloudUpload height={20} width={20} />
                        </div>
                        <p className="tw:text-sm tw:leading-5">
                          <span className="tw:text-brand-600 tw:font-semibold tw:cursor-pointer">
                            {t('label.click-to-upload')}
                          </span>{' '}
                          <span className="tw:text-secondary tw:cursor-pointer">
                            {t('label.or-drag-and-drop')}
                          </span>
                        </p>
                        <Typography
                          as="p"
                          className="tw:text-xs tw:leading-[18px] tw:mt-1 tw:text-secondary">
                          {t('label.supports-yaml-format')}
                        </Typography>
                      </label>
                    </div>
                  ) : (
                    <>
                      <div
                        className="file-info-card"
                        data-testid="file-info-card">
                        <div className="file-info">
                          <File06 className="file-icon" />
                          <Typography as="span" className="file-name">
                            {fileName}
                          </Typography>
                        </div>
                        <Button
                          className="remove-button"
                          color="tertiary"
                          data-testid="remove-file-button"
                          iconLeading={Trash01}
                          size="sm"
                          onPress={handleRemoveFile}
                        />
                      </div>

                      {renderObjectSelector()}
                      {renderContractPreview()}
                      {renderImportOptions()}
                    </>
                  )}
                </div>

                {yamlContent && (
                  <div
                    className={`validation-panel${
                      parseError ? ' error-bg' : ''
                    }`}>
                    {renderValidationPanel()}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <Button
                color="secondary"
                data-testid="cancel-button"
                isDisabled={isLoading}
                onPress={handleReset}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="import-button"
                isDisabled={isImportDisabled || isLoading}
                isLoading={isLoading || isValidating}
                onPress={handleImport}>
                {t('label.import')}
              </Button>
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ContractImportModal;
