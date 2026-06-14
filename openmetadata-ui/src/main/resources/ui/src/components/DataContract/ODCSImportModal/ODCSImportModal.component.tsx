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

import type { SelectItemType } from '@openmetadata/ui-core-components';
import {
  Badge,
  BadgeWithIcon,
  Box,
  Button,
  ButtonUtility,
  Card,
  Dialog,
  FileUploadDropZone,
  Modal,
  ModalOverlay,
  RadioButton,
  RadioGroup,
  Select,
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

  const isODCSFormat = format === 'odcs';

  useEffect(() => {
    if (!yamlContent || parseError) {
      setServerValidation(null);
      setServerValidationError(null);

      return;
    }

    // For ODCS format with multiple objects, wait for object selection
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
          // OM format validation
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
      // OM contracts must have a name field
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

  const handleDropFiles = useCallback(
    (files: FileList) => {
      const file = files[0];
      if (file) {
        processFile(file);
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
        await deleteContractById(existingContract?.id ?? '');

        return createContract(contractData) as Promise<DataContract>;
      } else if (hasExistingContract && importMode === 'merge') {
        const mergedForPatch: Record<string, unknown> = {
          ...existingContract,
          ...contractData,
        };

        // The OM export converts termsOfUse from entity object {content, inherited}
        // to a plain string (CreateDataContract format). Convert it back to entity
        // format so the JSON Patch targets the object fields correctly.
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
          existingContract?.id ?? '',
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

  const handleObjectSelectChange = useCallback((key: React.Key | null) => {
    setSelectedObjectName(key ? String(key) : '');
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
          className="tw:border tw:border-secondary tw:rounded-lg tw:p-4"
          data-testid="contract-preview-card">
          <Typography
            as="p"
            className="tw:text-gray-700"
            size="text-md"
            weight="semibold">
            {t('label.contract-preview')}
          </Typography>
          <Box className="tw:mb-2 tw:mt-3">
            <div className="tw:w-17.5">
              <Typography className="tw:shrink-0 tw:text-secondary">
                {t('label.name')}
              </Typography>
            </div>
            <Typography weight="medium">
              {odcsContract.name ?? t('label.not-specified')}
            </Typography>
          </Box>
          <Box className="tw:mb-2">
            <div className="tw:w-17.5">
              <Typography
                className="tw:shrink-0 tw:text-secondary"
                size="text-sm">
                {t('label.version')}
              </Typography>
            </div>
            <Typography weight="medium">{odcsContract.version}</Typography>
          </Box>
          <Box className="tw:mb-2">
            <div className="tw:w-17.5">
              <Typography className="tw:shrink-0 tw:text-secondary">
                {t('label.status')}
              </Typography>
            </div>
            <Typography weight="medium">{odcsContract.status}</Typography>
          </Box>
          {includedFeatures.length > 0 && (
            <Box className="tw:mt-3" gap={2} wrap="wrap">
              {includedFeatures.map((feature) => (
                <Badge color="gray" key={feature} size="sm" type="color">
                  {feature}
                </Badge>
              ))}
            </Box>
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
      <Card className="tw:p-4">
        <Typography
          as="p"
          className="tw:text-gray-700"
          size="text-md"
          weight="semibold">
          {t('label.contract-preview')}
        </Typography>
        <Box className="tw:mb-2 tw:mt-3">
          <div className="tw:w-17.5">
            <Typography className="tw:shrink-0 tw:text-gray-700" size="text-sm">
              {t('label.name')}
            </Typography>
          </div>
          <Typography size="text-sm" weight="medium">
            {omContract.name ?? t('label.not-specified')}
          </Typography>
        </Box>
        {omContract.displayName && (
          <Box className="tw:mb-2">
            <div className="tw:w-17.5">
              <Typography
                className="tw:shrink-0 tw:text-gray-700"
                size="text-sm">
                {t('label.display-name')}
              </Typography>
            </div>
            <Typography as="span" size="text-sm" weight="medium">
              {omContract.displayName}
            </Typography>
          </Box>
        )}
        {includedFeatures.length > 0 && (
          <Box className="tw:mt-3" gap={2} wrap="wrap">
            {includedFeatures.map((feature) => (
              <Badge color="gray" key={feature} size="sm" type="color">
                {feature}
              </Badge>
            ))}
          </Box>
        )}
      </Card>
    );
  }, [parsedContract, isODCSFormat, t]);

  const renderValidationPanel = useCallback(() => {
    if (parseError) {
      return (
        <Card
          className="tw:h-full tw:flex tw:flex-col tw:p-4"
          data-testid="parse-error-panel">
          <Box
            align="center"
            className="tw:mb-4 tw:pb-4 tw:border-b tw:border-utility-error-100"
            justify="between">
            <Typography weight="semibold">{t('label.parse-error')}</Typography>
            <BadgeWithIcon
              color="error"
              iconLeading={XClose}
              size="sm"
              type="pill-color">
              {t('label.failed')}
            </BadgeWithIcon>
          </Box>
          <div className="tw:flex-1 tw:min-h-50 tw:mb-4">
            <Typography className="tw:text-secondary">
              {isODCSFormat
                ? t('message.invalid-odcs-contract-format-required-fields')
                : t(
                    'message.invalid-openmetadata-contract-format-required-fields'
                  )}
            </Typography>
            <Box className="tw:mt-3" direction="col" gap={2}>
              {(isODCSFormat ? ['APIVersion', 'Kind', 'Status'] : ['name']).map(
                (field) => (
                  <Box align="center" gap={2} key={field}>
                    <div className="tw:w-1.5 tw:h-1.5 tw:rounded-full tw:bg-utility-error-600 tw:shrink-0" />
                    <Typography>{field}</Typography>
                  </Box>
                )
              )}
            </Box>
          </div>
          <div className="tw:mt-auto tw:pt-4 tw:border-t tw:border-utility-error-100">
            <Box align="center" gap={2}>
              <XCircle className="tw:text-utility-error-600" size={16} />
              <Typography as="span" size="text-sm">
                {t('label.syntax')} : <strong>{t('label.invalid')}</strong>
              </Typography>
            </Box>
          </div>
        </Card>
      );
    }

    if (isValidating) {
      return (
        <Box
          align="center"
          className="tw:bg-bg-secondary tw:rounded-lg tw:h-full"
          direction="col"
          justify="center">
          <Loader size="small" style={{ marginBottom: '12px' }} />
          <Typography as="p" className="tw:text-secondary" size="text-sm">
            {t('message.validating-contract-schema')}
          </Typography>
        </Box>
      );
    }

    if (serverValidationError) {
      return (
        <Box
          className="tw:bg-bg-secondary tw:rounded-lg tw:h-full"
          data-testid="server-validation-error-panel"
          direction="col">
          <Box
            align="center"
            className="tw:mb-4 tw:pb-4 tw:border-b tw:border-secondary"
            justify="between">
            <Typography as="span" size="text-sm" weight="semibold">
              {t('label.schema-validation')}
            </Typography>
            <BadgeWithIcon
              color="error"
              iconLeading={XClose}
              size="sm"
              type="pill-color">
              {t('label.failed')}
            </BadgeWithIcon>
          </Box>
          <div className="tw:flex-1 tw:min-h-50 tw:mb-4">
            <Typography as="p" className="tw:text-secondary tw:wrap-break-word">
              {serverValidationError}
            </Typography>
          </div>
          <div className="tw:mt-auto tw:pt-4 tw:border-t tw:border-secondary">
            <Box align="center" className="tw:mb-2" gap={2}>
              <CheckCircle className="tw:text-utility-success-500" size={16} />
              <Typography>
                {t('label.syntax')} : <strong>{t('label.valid')}</strong>
              </Typography>
            </Box>
            <Box align="center" gap={2}>
              <XCircle className="tw:text-utility-error-600" size={16} />
              <Typography>
                {t('label.schema')} : <strong>{t('label.error')}</strong>
              </Typography>
            </Box>
          </div>
        </Box>
      );
    }

    if (
      serverValidation?.schemaValidation?.failed !== undefined &&
      serverValidation.schemaValidation.failed > 0
    ) {
      return (
        <Box
          className="tw:bg-bg-secondary tw:rounded-lg tw:h-full"
          data-testid="server-validation-failed-error-panel"
          direction="col">
          <Box
            align="center"
            className="tw:mb-4 tw:pb-4 tw:border-b tw:border-secondary"
            justify="between">
            <Typography as="span" size="text-sm" weight="semibold">
              {t('label.schema-validation')}
            </Typography>
            <Badge color="error" size="sm" type="color">
              <XClose size={12} />
              {t('label.failed')}
            </Badge>
          </Box>
          <div className="tw:flex-1 tw:min-h-50 tw:overflow-y-auto">
            <Box data-testid="failed-fields-list" direction="col" gap={2}>
              {serverValidation.schemaValidation?.failedFields?.map(
                (field, index) => (
                  <Box align="center" gap={2} key={`notfound-${index}`}>
                    <div className="tw:w-1.5 tw:h-1.5 tw:rounded-full tw:bg-utility-error-600 tw:shrink-0" />
                    <Typography
                      as="span"
                      data-testid={`failed-field-${index}`}
                      size="text-sm">
                      {field} - {t('label.not-found-lowercase')}
                    </Typography>
                  </Box>
                )
              )}
              {serverValidation.schemaValidation?.duplicateFields?.map(
                (field, index) => (
                  <Box align="center" gap={2} key={`duplicate-${index}`}>
                    <div className="tw:w-1.5 tw:h-1.5 tw:rounded-full tw:bg-utility-error-600 tw:shrink-0" />
                    <Typography
                      as="span"
                      data-testid={`duplicate-field-${index}`}
                      size="text-sm">
                      {field} - {t('label.duplicate')}
                    </Typography>
                  </Box>
                )
              )}
              {serverValidation.schemaValidation?.typeMismatchFields?.map(
                (field, index) => (
                  <Box align="center" gap={2} key={`typemismatch-${index}`}>
                    <div className="tw:w-1.5 tw:h-1.5 tw:rounded-full tw:bg-utility-error-600 tw:shrink-0" />
                    <Typography
                      as="span"
                      data-testid={`type-mismatch-field-${index}`}
                      size="text-sm">
                      {field}
                    </Typography>
                  </Box>
                )
              )}
            </Box>
          </div>
          <div className="tw:mt-auto tw:pt-4 tw:border-t tw:border-secondary">
            <Box align="center" className="tw:mb-2" gap={2}>
              <CheckCircle className="tw:text-utility-success-500" size={16} />
              <Typography as="span" size="text-sm">
                {t('label.syntax')} : <strong>{t('label.valid')}</strong>
              </Typography>
            </Box>
            <Box align="center" gap={2}>
              <XCircle className="tw:text-utility-error-600" size={16} />
              <Typography as="span" size="text-sm">
                {t('label.schema')} :{' '}
                {serverValidation.schemaValidation?.failed}{' '}
                {t('label.field-plural-lowercase')} {t('label.with-issues')}
              </Typography>
            </Box>
          </div>
        </Box>
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
        <Box
          className="tw:bg-bg-secondary tw:rounded-lg tw:h-full"
          data-testid="entity-validation-error-panel"
          direction="col">
          <Box
            align="center"
            className="tw:mb-4 tw:pb-4 tw:border-b tw:border-secondary"
            justify="between">
            <Typography as="span" size="text-sm" weight="semibold">
              {t('label.contract-validation')}
            </Typography>
            <Badge color="error" size="sm" type="color">
              <XClose size={12} />
              {t('label.failed')}
            </Badge>
          </Box>
          <div className="tw:flex-1 tw:min-h-50 tw:mb-4">
            <Box data-testid="entity-errors-list" direction="col" gap={2}>
              {allErrors.map((error, index) => (
                <Box
                  align="start"
                  gap={2}
                  key={`error-${index}-${error.substring(0, 20)}`}>
                  <div className="tw:w-1.5 tw:h-1.5 tw:rounded-full tw:bg-utility-error-600 tw:shrink-0 tw:mt-[6px]" />
                  <Typography
                    as="span"
                    className="tw:wrap-break-word"
                    data-testid={`entity-error-${index}`}
                    size="text-sm">
                    {error}
                  </Typography>
                </Box>
              ))}
            </Box>
          </div>
          <div className="tw:mt-auto tw:pt-4 tw:border-t tw:border-secondary">
            <Box align="center" className="tw:mb-2" gap={2}>
              <CheckCircle className="tw:text-utility-success-500" size={16} />
              <Typography as="span" size="text-sm">
                {t('label.syntax')} : <strong>{t('label.valid')}</strong>
              </Typography>
            </Box>
            <Box align="center" gap={2}>
              <XCircle className="tw:text-utility-error-600" size={16} />
              <Typography as="span" size="text-sm">
                {t('label.contract')} :{' '}
                <strong>{t('label.validation-failed')}</strong>
              </Typography>
            </Box>
          </div>
        </Box>
      );
    }

    const hasTypeMismatches =
      serverValidation?.schemaValidation?.typeMismatchFields &&
      serverValidation.schemaValidation.typeMismatchFields.length > 0;

    return (
      <Box
        className="tw:bg-bg-secondary tw:rounded-lg tw:h-full"
        data-testid="validation-success-panel"
        direction="col">
        <Box
          align="center"
          className="tw:mb-4 tw:pb-4 tw:border-b tw:border-secondary"
          justify="between">
          <Typography as="span" size="text-sm" weight="semibold">
            {t('label.schema-validation')}
          </Typography>
          <BadgeWithIcon
            color={hasTypeMismatches ? 'warning' : 'success'}
            iconLeading={CheckVerified01}
            size="sm"
            type="pill-color">
            {hasTypeMismatches
              ? t('label.passed-with-warnings')
              : t('label.passed')}
          </BadgeWithIcon>
        </Box>
        <div className="tw:flex-1 tw:min-h-50 tw:overflow-y-auto tw:mb-4">
          <Typography as="p" className="tw:text-secondary" size="text-sm">
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
                className="tw:text-utility-warning-700 tw:mb-2"
                size="text-sm"
                weight="semibold">
                {t('label.type-mismatches')}
              </Typography>
              <Box
                data-testid="type-mismatch-warnings-list"
                direction="col"
                gap={2}>
                {serverValidation?.schemaValidation?.typeMismatchFields?.map(
                  (field, index) => (
                    <Box
                      align="center"
                      gap={2}
                      key={`typemismatch-warning-${index}`}>
                      <AlertTriangle
                        className="tw:text-utility-warning-600"
                        size={14}
                      />
                      <Typography
                        as="span"
                        data-testid={`type-mismatch-warning-${index}`}
                        size="text-sm">
                        {field}
                      </Typography>
                    </Box>
                  )
                )}
              </Box>
            </div>
          )}
        </div>
        <div className="tw:mt-auto tw:pt-4 tw:border-t tw:border-secondary">
          <Box align="center" className="tw:mb-2" gap={2}>
            <CheckCircle className="tw:text-utility-success-700" size={16} />
            <Typography as="span" size="text-sm">
              {t('label.syntax')} : <strong>{t('label.valid')}</strong>
            </Typography>
          </Box>
          {serverValidation?.schemaValidation?.total !== undefined &&
            serverValidation.schemaValidation.total > 0 && (
              <Box align="center" gap={2}>
                <CheckCircle
                  className="tw:text-utility-success-700"
                  size={16}
                />
                <Typography as="span" size="text-sm">
                  {t('label.schema')} :{' '}
                  {serverValidation.schemaValidation?.passed}{' '}
                  {t('label.field-plural-lowercase')} {t('label.verified')}
                </Typography>
              </Box>
            )}
        </div>
      </Box>
    );
  }, [parseError, isValidating, serverValidationError, serverValidation, t]);

  const renderImportOptions = useCallback(() => {
    if (!hasExistingContract) {
      return null;
    }

    return (
      <Box className="tw:mt-4" direction="col" gap={3}>
        <Card
          className="tw:flex tw:items-start tw:gap-3 tw:p-3"
          color="warning"
          data-testid="existing-contract-warning">
          <AlertTriangle
            className="tw:text-warning-600 tw:mt-0.5 tw:shrink-0"
            size={16}
          />
          <Typography as="p" className="tw:text-warning-800 tw:leading-5">
            {t('message.existing-contract-detected')}{' '}
            <strong>{t('message.please-select-action-below')}</strong>
          </Typography>
        </Card>

        <RadioGroup
          className="tw:gap-0"
          value={importMode}
          onChange={handleImportModeChange}>
          <Card
            className="tw:p-3 tw:mb-2 tw:cursor-pointer tw:transition-colors tw:hover:border-utility-brand-200"
            color={importMode === 'merge' ? 'brand' : 'default'}
            data-testid="import-mode-merge"
            role="button"
            tabIndex={0}
            onClick={() => setImportMode('merge')}
            onKeyDown={(e) => e.key === 'Enter' && setImportMode('merge')}>
            <Box align="start" justify="between">
              <div>
                <Typography as="p" size="text-sm" weight="semibold">
                  {t('label.merge-with-existing')}
                </Typography>
                <Typography
                  as="p"
                  className="tw:text-secondary tw:leading-5"
                  size="text-xs">
                  {t('message.import-mode-merge-description')}
                </Typography>
              </div>
              <RadioButton className="tw:p-0" value="merge" />
            </Box>
          </Card>
          <Card
            className="tw:p-3 tw:transition-colors tw:cursor-pointer tw:hover:border-utility-brand-200"
            color={importMode === 'replace' ? 'brand' : 'default'}
            data-testid="import-mode-replace"
            role="button"
            tabIndex={0}
            onClick={() => setImportMode('replace')}
            onKeyDown={(e) => e.key === 'Enter' && setImportMode('replace')}>
            <Box align="start" justify="between">
              <div>
                <Typography as="p" weight="semibold">
                  {t('label.replace-entire-contract')}
                </Typography>
                <Typography
                  as="p"
                  className="tw:text-secondary tw:leading-5"
                  size="text-xs">
                  {t('message.import-mode-replace-description')}
                </Typography>
              </div>
              <RadioButton className="tw:p-0" value="replace" />
            </Box>
          </Card>
        </RadioGroup>
      </Box>
    );
  }, [hasExistingContract, importMode, handleImportModeChange, t]);

  const renderObjectSelector = useCallback(() => {
    if (!isODCSFormat || schemaObjects.length <= 1) {
      return null;
    }

    const selectItems: SelectItemType[] = schemaObjects.map((obj) => ({
      id: obj,
      label: obj,
    }));

    return (
      <div
        className="tw:rounded-xl tw:bg-gray-50 tw:p-3.5 tw:mb-4"
        data-testid="object-selector-section">
        <Box align="center" className="tw:mb-2.5" gap={2}>
          <Typography
            as="span"
            data-testid="multi-object-contract-detected"
            size="text-sm"
            weight="semibold">
            {t('message.multi-object-contract-detected')}
          </Typography>
        </Box>
        <Box direction="col" gap={2}>
          <Select
            data-testid="schema-object-select"
            items={selectItems}
            placeholder={t('label.select-schema-object')}
            selectedKey={selectedObjectName || null}
            onSelectionChange={handleObjectSelectChange}>
            {(item) => (
              <Select.Item
                data-testid={`schema-object-option-${item.id}`}
                id={item.id}
                key={item.id}>
                {item.label}
              </Select.Item>
            )}
          </Select>
        </Box>
      </div>
    );
  }, [
    isODCSFormat,
    schemaObjects,
    selectedObjectName,
    handleObjectSelectChange,
    t,
  ]);

  const isImportDisabled =
    !yamlContent ||
    Boolean(parseError) ||
    isValidating ||
    hasValidationErrors ||
    (hasMultipleObjects && !selectedObjectName);

  return (
    <ModalOverlay
      isDismissable={!isLoading}
      isOpen={visible}
      onOpenChange={(open) => !open && handleReset()}>
      <Modal>
        <Dialog
          data-testid="import-contract-modal"
          showCloseButton={!isLoading}
          width={yamlContent ? 900 : 680}
          onClose={handleReset}>
          <Dialog.Header>
            <Typography
              as="p"
              data-testid="import-contract-modal-title"
              size="text-sm"
              weight="semibold">
              {isODCSFormat
                ? t('label.import-odcs-contract')
                : t('label.import-contract')}
            </Typography>
            <Typography as="p" className="tw:text-secondary" size="text-sm">
              {t('message.upload-file-description')}
            </Typography>
          </Dialog.Header>

          <Dialog.Content className="tw:max-h-[70vh] tw:overflow-y-auto">
            <Box
              gap={5}
              style={{
                minHeight: yamlContent ? '400px' : 'auto',
                marginTop: yamlContent ? '16px' : '0',
              }}>
              <div className="tw:flex-1">
                {yamlContent ? (
                  <>
                    <Box
                      align="center"
                      className="tw:mb-4 tw:px-4 tw:py-3 tw:rounded tw:bg-gray-50"
                      data-testid="file-info-card"
                      justify="between">
                      <Box align="center" gap={2}>
                        <File06 className="tw:text-gray-500" size={24} />
                        <div className="tw:max-w-70">
                          <Typography
                            ellipsis
                            as="p"
                            className="tw:text-gray-700"
                            size="text-md"
                            weight="medium">
                            {fileName}
                          </Typography>
                        </div>
                      </Box>

                      <ButtonUtility
                        color="tertiary"
                        data-testid="remove-file-button"
                        icon={<Trash01 size={16} />}
                        size="sm"
                        title={t('label.delete-entity', {
                          entity: t('label.file'),
                        })}
                        onClick={handleRemoveFile}
                      />
                    </Box>

                    {renderObjectSelector()}
                    {renderContractPreview()}
                    {renderImportOptions()}
                  </>
                ) : (
                  <FileUploadDropZone
                    accept=".yaml,.yml,.json"
                    className="tw:w-full"
                    clickToUploadLabel={t('label.click-to-upload')}
                    hint={t('label.supports-yaml-format')}
                    input-data-testid="file-upload-input"
                    orDragAndDropLabel={t('label.or-drag-and-drop')}
                    onDropFiles={handleDropFiles}
                  />
                )}
              </div>

              {yamlContent && (
                <Card
                  className={`tw:w-[320px] tw:shrink-0 tw:flex tw:flex-col tw:self-start tw:p-4 tw:overflow-auto ${
                    parseError ? 'tw:bg-utility-error-50' : 'tw:bg-bg-secondary'
                  }`}>
                  {renderValidationPanel()}
                </Card>
              )}
            </Box>
          </Dialog.Content>

          <Dialog.Footer>
            <Box className="tw:col-span-2" gap={3} justify="end">
              <Button
                color="secondary"
                data-testid="cancel-button"
                isDisabled={isLoading}
                onClick={handleReset}>
                {t('label.cancel')}
              </Button>
              <Button
                showTextWhileLoading
                color="primary"
                data-testid="import-button"
                isDisabled={isImportDisabled || isLoading}
                isLoading={isLoading || isValidating}
                onClick={handleImport}>
                {t('label.import')}
              </Button>
            </Box>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ContractImportModal;
