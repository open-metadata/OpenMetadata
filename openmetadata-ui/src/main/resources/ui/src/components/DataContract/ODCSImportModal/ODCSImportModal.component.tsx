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
  CheckCircleOutlineOutlined,
  DeleteOutlineOutlined,
  TaskAltOutlined,
} from '@mui/icons-material';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  SelectChangeEvent,
  Typography,
  useTheme,
} from '@mui/material';
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
  const theme = useTheme();
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

  const handleImportModeChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setImportMode(event.target.value as ImportMode);
    },
    []
  );

  const handleObjectSelectChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      setSelectedObjectName(event.target.value);
    },
    []
  );

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
        <Box
          data-testid="contract-preview-card"
          sx={{
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: '8px',
            p: '16px',
          }}>
          <Typography
            sx={{
              fontSize: '16px',
              fontWeight: 600,
              color: theme.palette.text.secondary,
              mb: '12px',
            }}>
            {t('label.contract-preview')}
          </Typography>
          <Box sx={{ display: 'flex', mb: '8px' }}>
            <Typography
              sx={{
                fontSize: '14px',
                color: theme.palette.text.secondary,
                width: '70px',
                flexShrink: 0,
              }}>
              {t('label.name')}
            </Typography>
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: 500,
                color: theme.palette.text.primary,
              }}>
              {odcsContract.name ?? t('label.not-specified')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', mb: '8px' }}>
            <Typography
              sx={{
                fontSize: '14px',
                color: theme.palette.text.secondary,
                width: '70px',
                flexShrink: 0,
              }}>
              {t('label.version')}
            </Typography>
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: 500,
                color: theme.palette.text.primary,
              }}>
              {odcsContract.version}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', mb: '8px' }}>
            <Typography
              sx={{
                fontSize: '14px',
                color: theme.palette.text.secondary,
                width: '70px',
                flexShrink: 0,
              }}>
              {t('label.status')}
            </Typography>
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: 500,
                color: theme.palette.text.primary,
              }}>
              {odcsContract.status}
            </Typography>
          </Box>
          {includedFeatures.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                mt: '12px',
              }}>
              {includedFeatures.map((feature) => (
                <Chip
                  key={feature}
                  label={feature}
                  size="small"
                  sx={{
                    fontSize: '12px',
                    height: '24px',
                    backgroundColor: theme.palette.grey[100],
                    border: 'none',
                    borderRadius: '4px',
                    color: theme.palette.text.secondary,
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
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
      <Box
        sx={{
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: '8px',
          p: '16px',
        }}>
        <Typography
          sx={{
            fontSize: '16px',
            fontWeight: 600,
            color: theme.palette.text.secondary,
            letterSpacing: '0.5px',
            mb: '12px',
          }}>
          {t('label.contract-preview')}
        </Typography>
        <Box sx={{ display: 'flex', mb: '8px' }}>
          <Typography
            sx={{
              fontSize: '14px',
              color: theme.palette.text.secondary,
              width: '70px',
              flexShrink: 0,
            }}>
            {t('label.name')}
          </Typography>
          <Typography
            sx={{
              fontSize: '14px',
              fontWeight: 500,
              color: theme.palette.text.primary,
            }}>
            {omContract.name ?? t('label.not-specified')}
          </Typography>
        </Box>
        {omContract.displayName && (
          <Box sx={{ display: 'flex', mb: '8px' }}>
            <Typography
              sx={{
                fontSize: '14px',
                color: theme.palette.text.secondary,
                width: '70px',
                flexShrink: 0,
              }}>
              {t('label.display-name')}
            </Typography>
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: 500,
                color: theme.palette.text.primary,
              }}>
              {omContract.displayName}
            </Typography>
          </Box>
        )}
        {includedFeatures.length > 0 && (
          <Box
            sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap', mt: '12px' }}>
            {includedFeatures.map((feature) => (
              <Chip
                key={feature}
                label={feature}
                size="small"
                sx={{
                  fontSize: '12px',
                  height: '24px',
                  backgroundColor: theme.palette.grey[100],
                  border: 'none',
                  borderRadius: '4px',
                  color: theme.palette.text.secondary,
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    );
  }, [parsedContract, isODCSFormat, t, theme]);

  const renderValidationPanel = useCallback(() => {
    if (parseError) {
      return (
        <Box
          data-testid="parse-error-panel"
          sx={{
            borderRadius: '8px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: '16px',
              pb: '16px',
              borderBottom: `1px solid ${theme.palette.allShades.error[100]}`,
            }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
              {t('label.parse-error')}
            </Typography>
            <Chip
              icon={<CloseIcon sx={{ fontSize: '12px !important' }} />}
              label={t('label.failed')}
              size="small"
              sx={{
                backgroundColor: theme.palette.allShades.error[50],
                color: theme.palette.allShades.error[600],
                fontSize: '12px',
                height: '22px',
                '& .MuiChip-icon': {
                  color: theme.palette.allShades.error[600],
                },
              }}
            />
          </Box>
          <Box sx={{ flex: 1, minHeight: '200px' }}>
            <Typography
              sx={{
                fontSize: '14px',
                color: theme.palette.text.secondary,
                mb: '12px',
              }}>
              {isODCSFormat
                ? t('message.invalid-odcs-contract-format-required-fields')
                : t(
                    'message.invalid-openmetadata-contract-format-required-fields'
                  )}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(isODCSFormat ? ['APIVersion', 'Kind', 'Status'] : ['name']).map(
                (field) => (
                  <Box
                    key={field}
                    sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.allShades.error[600],
                      }}
                    />
                    <Typography sx={{ fontSize: '14px' }}>{field}</Typography>
                  </Box>
                )
              )}
            </Box>
          </Box>
          <Box
            sx={{
              mt: 'auto',
              pt: '16px',
              borderTop: `1px solid ${theme.palette.allShades.error[100]}`,
            }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CancelIcon
                sx={{
                  fontSize: '16px',
                  color: theme.palette.allShades.error[600],
                }}
              />
              <Typography sx={{ fontSize: '14px' }}>
                {t('label.syntax')} : <strong>{t('label.invalid')}</strong>
              </Typography>
            </Box>
          </Box>
        </Box>
      );
    }

    if (isValidating) {
      return (
        <Box
          sx={{
            backgroundColor: theme.palette.grey[50],
            borderRadius: '8px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <CircularProgress size={24} sx={{ mb: '12px' }} />
          <Typography
            sx={{ fontSize: '14px', color: theme.palette.text.secondary }}>
            {t('message.validating-contract-schema')}
          </Typography>
        </Box>
      );
    }

    if (serverValidationError) {
      return (
        <Box
          data-testid="server-validation-error-panel"
          sx={{
            backgroundColor: theme.palette.grey[50],
            borderRadius: '8px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: '16px',
              pb: '16px',
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
              {t('label.schema-validation')}
            </Typography>
            <Chip
              icon={<CloseIcon sx={{ fontSize: '12px !important' }} />}
              label={t('label.failed')}
              size="small"
              sx={{
                backgroundColor: theme.palette.allShades.error[50],
                color: theme.palette.allShades.error[600],
                fontSize: '12px',
                height: '22px',
                '& .MuiChip-icon': {
                  color: theme.palette.allShades.error[600],
                },
              }}
            />
          </Box>
          <Box sx={{ flex: 1, minHeight: '200px' }}>
            <Typography
              sx={{ fontSize: '14px', color: theme.palette.text.secondary }}>
              {serverValidationError}
            </Typography>
          </Box>
          <Box
            sx={{
              mt: 'auto',
              pt: '16px',
              borderTop: `1px solid ${theme.palette.divider}`,
            }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                mb: '8px',
              }}>
              <CheckCircleIcon
                sx={{
                  fontSize: '16px',
                  color: theme.palette.allShades.success[500],
                }}
              />
              <Typography sx={{ fontSize: '14px' }}>
                {t('label.syntax')} : <strong>{t('label.valid')}</strong>
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CancelIcon
                sx={{
                  fontSize: '16px',
                  color: theme.palette.allShades.error[600],
                }}
              />
              <Typography sx={{ fontSize: '14px' }}>
                {t('label.schema')} : <strong>{t('label.error')}</strong>
              </Typography>
            </Box>
          </Box>
        </Box>
      );
    }

    if (
      serverValidation?.schemaValidation?.failed !== undefined &&
      serverValidation.schemaValidation.failed > 0
    ) {
      return (
        <Box
          data-testid="server-validation-failed-error-panel"
          sx={{
            backgroundColor: theme.palette.grey[50],
            borderRadius: '8px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: '16px',
              pb: '16px',
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
              {t('label.schema-validation')}
            </Typography>
            <Chip
              icon={<CloseIcon sx={{ fontSize: '12px !important' }} />}
              label={t('label.failed')}
              size="small"
              sx={{
                backgroundColor: theme.palette.allShades.error[50],
                color: theme.palette.allShades.error[600],
                fontSize: '12px',
                height: '22px',
                '& .MuiChip-icon': {
                  color: theme.palette.allShades.error[600],
                },
              }}
            />
          </Box>
          <Box
            sx={{
              flex: 1,
              minHeight: '200px',
              overflowY: 'auto',
            }}>
            <Box
              data-testid="failed-fields-list"
              sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {serverValidation.schemaValidation?.failedFields?.map(
                (field, index) => (
                  <Box
                    key={`notfound-${index}`}
                    sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.allShades.error[600],
                      }}
                    />
                    <Typography
                      data-testid={`failed-field-${index}`}
                      sx={{ fontSize: '14px' }}>
                      {field} - {t('label.not-found-lowercase')}
                    </Typography>
                  </Box>
                )
              )}
              {serverValidation.schemaValidation?.duplicateFields?.map(
                (field, index) => (
                  <Box
                    key={`duplicate-${index}`}
                    sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.allShades.error[600],
                      }}
                    />
                    <Typography
                      data-testid={`duplicate-field-${index}`}
                      sx={{ fontSize: '14px' }}>
                      {field} - {t('label.duplicate')}
                    </Typography>
                  </Box>
                )
              )}
              {serverValidation.schemaValidation?.typeMismatchFields?.map(
                (field, index) => (
                  <Box
                    key={`typemismatch-${index}`}
                    sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: theme.palette.allShades.error[600],
                      }}
                    />
                    <Typography
                      data-testid={`type-mismatch-field-${index}`}
                      sx={{ fontSize: '14px' }}>
                      {field}
                    </Typography>
                  </Box>
                )
              )}
            </Box>
          </Box>
          <Box
            sx={{
              mt: 'auto',
              pt: '16px',
              borderTop: `1px solid ${theme.palette.divider}`,
            }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                mb: '8px',
              }}>
              <CheckCircleIcon
                sx={{
                  fontSize: '16px',
                  color: theme.palette.allShades.success[500],
                }}
              />
              <Typography sx={{ fontSize: '14px' }}>
                {t('label.syntax')} : <strong>{t('label.valid')}</strong>
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CancelIcon
                sx={{
                  fontSize: '16px',
                  color: theme.palette.allShades.error[600],
                }}
              />
              <Typography sx={{ fontSize: '14px' }}>
                {t('label.schema')} :{' '}
                {serverValidation.schemaValidation?.failed}{' '}
                {t('label.field-plural-lowercase')} {t('label.with-issues')}
              </Typography>
            </Box>
          </Box>
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
          data-testid="entity-validation-error-panel"
          sx={{
            backgroundColor: theme.palette.grey[50],
            borderRadius: '8px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: '16px',
              pb: '16px',
              borderBottom: `1px solid ${theme.palette.divider}`,
            }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
              {t('label.contract-validation')}
            </Typography>
            <Chip
              icon={<CloseIcon sx={{ fontSize: '12px !important' }} />}
              label={t('label.failed')}
              size="small"
              sx={{
                backgroundColor: theme.palette.allShades.error[50],
                color: theme.palette.allShades.error[600],
                fontSize: '12px',
                height: '22px',
                '& .MuiChip-icon': {
                  color: theme.palette.allShades.error[600],
                },
              }}
            />
          </Box>
          <Box sx={{ flex: 1, minHeight: '200px' }}>
            <Box
              data-testid="entity-errors-list"
              sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {allErrors.map((error, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}>
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: theme.palette.allShades.error[600],
                      mt: '6px',
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    data-testid={`entity-error-${index}`}
                    sx={{ fontSize: '14px', wordBreak: 'break-word' }}>
                    {error}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
          <Box
            sx={{
              mt: 'auto',
              pt: '16px',
              borderTop: `1px solid ${theme.palette.divider}`,
            }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                mb: '8px',
              }}>
              <CheckCircleIcon
                sx={{
                  fontSize: '16px',
                  color: theme.palette.allShades.success[500],
                }}
              />
              <Typography sx={{ fontSize: '14px' }}>
                {t('label.syntax')} : <strong>{t('label.valid')}</strong>
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CancelIcon
                sx={{
                  fontSize: '16px',
                  color: theme.palette.allShades.error[600],
                }}
              />
              <Typography sx={{ fontSize: '14px' }}>
                {t('label.contract')} :{' '}
                <strong>{t('label.validation-failed')}</strong>
              </Typography>
            </Box>
          </Box>
        </Box>
      );
    }

    const hasTypeMismatches =
      serverValidation?.schemaValidation?.typeMismatchFields &&
      serverValidation.schemaValidation.typeMismatchFields.length > 0;

    return (
      <Box
        data-testid="validation-success-panel"
        sx={{
          backgroundColor: theme.palette.grey[50],
          borderRadius: '8px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: '16px',
            pb: '16px',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}>
          <Typography
            sx={{
              fontSize: '14px',
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}>
            {t('label.schema-validation')}
          </Typography>
          <Chip
            icon={<TaskAltOutlined sx={{ fontSize: '12px !important' }} />}
            label={
              hasTypeMismatches
                ? t('label.passed-with-warnings')
                : t('label.passed')
            }
            size="small"
            sx={{
              backgroundColor: hasTypeMismatches
                ? theme.palette.allShades.warning[50]
                : theme.palette.allShades.success[50],
              color: hasTypeMismatches
                ? theme.palette.allShades.warning[700]
                : theme.palette.allShades.success[700],
              fontSize: '12px',
              height: '22px',
              '& .MuiChip-icon': {
                color: hasTypeMismatches
                  ? theme.palette.allShades.warning[700]
                  : theme.palette.allShades.success[700],
              },
            }}
          />
        </Box>
        <Box sx={{ flex: 1, minHeight: '200px', overflowY: 'auto' }}>
          <Typography
            sx={{ fontSize: '14px', color: theme.palette.text.secondary }}>
            {serverValidation?.schemaValidation?.total &&
            serverValidation.schemaValidation.total > 0
              ? t('message.schema-validation-passed', {
                  count: serverValidation.schemaValidation?.passed,
                })
              : t('message.contract-syntax-valid')}
          </Typography>
          {hasTypeMismatches && (
            <Box sx={{ mt: '16px' }}>
              <Typography
                sx={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.palette.allShades.warning[700],
                  mb: '8px',
                }}>
                {t('label.type-mismatches')}
              </Typography>
              <Box
                data-testid="type-mismatch-warnings-list"
                sx={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {serverValidation.schemaValidation.typeMismatchFields.map(
                  (field, index) => (
                    <Box
                      key={`typemismatch-warning-${index}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                      <WarningAmberIcon
                        sx={{
                          fontSize: '14px',
                          color: theme.palette.allShades.warning[600],
                        }}
                      />
                      <Typography
                        data-testid={`type-mismatch-warning-${index}`}
                        sx={{ fontSize: '14px' }}>
                        {field}
                      </Typography>
                    </Box>
                  )
                )}
              </Box>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            mt: 'auto',
            pt: '16px',
            borderTop: `1px solid ${theme.palette.divider}`,
          }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              mb: '8px',
            }}>
            <CheckCircleOutlineOutlined
              sx={{
                fontSize: '16px',
                color: theme.palette.allShades.success[700],
              }}
            />
            <Typography sx={{ fontSize: '14px' }}>
              {t('label.syntax')} : <strong>{t('label.valid')}</strong>
            </Typography>
          </Box>
          {serverValidation?.schemaValidation?.total !== undefined &&
            serverValidation.schemaValidation.total > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircleOutlineOutlined
                  sx={{
                    fontSize: '16px',
                    color: theme.palette.allShades.success[700],
                  }}
                />
                <Typography sx={{ fontSize: '14px' }}>
                  {t('label.schema')} :{' '}
                  {serverValidation.schemaValidation?.passed}{' '}
                  {t('label.field-plural-lowercase')} {t('label.verified')}
                </Typography>
              </Box>
            )}
        </Box>
      </Box>
    );
  }, [
    parseError,
    isValidating,
    serverValidationError,
    serverValidation,
    t,
    theme,
  ]);

  const renderImportOptions = useCallback(() => {
    if (!hasExistingContract) {
      return null;
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginTop: '16px',
        }}>
        <Box
          data-testid="existing-contract-warning"
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            backgroundColor: theme.palette.allShades.warning[50],
            border: `1px solid ${theme.palette.allShades.warning[300]}`,
            borderRadius: '8px',
            p: '12px',
          }}>
          <WarningAmberIcon
            sx={{
              color: theme.palette.allShades.warning[600],
              fontSize: '20px',
              mt: '2px',
            }}
          />
          <Typography
            sx={{
              fontSize: '14px',
              color: theme.palette.allShades.warning[800],
              lineHeight: '20px',
            }}>
            {t('message.existing-contract-detected')}{' '}
            <strong>{t('message.please-select-action-below')}</strong>
          </Typography>
        </Box>

        <FormControl component="fieldset" sx={{ width: '100%' }}>
          <RadioGroup value={importMode} onChange={handleImportModeChange}>
            <Box
              sx={{
                border: `1px solid ${
                  importMode === 'merge'
                    ? theme.palette.primary.main
                    : theme.palette.divider
                }`,
                borderRadius: '8px',
                p: '12px',
                mb: '8px',
                cursor: 'pointer',
                backgroundColor:
                  importMode === 'merge'
                    ? 'rgba(25, 118, 210, 0.04)'
                    : 'transparent',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                },
              }}
              onClick={() => setImportMode('merge')}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}>
                <Box>
                  <Typography
                    sx={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                    }}>
                    {t('label.merge-with-existing')}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '12px',
                      color: theme.palette.text.secondary,
                      lineHeight: '20px',
                    }}>
                    {t('message.import-mode-merge-description')}
                  </Typography>
                </Box>
                <Radio
                  checked={importMode === 'merge'}
                  sx={{ p: 0 }}
                  value="merge"
                />
              </Box>
            </Box>
            <Box
              sx={{
                border: `1px solid ${
                  importMode === 'replace'
                    ? theme.palette.primary.main
                    : theme.palette.divider
                }`,
                borderRadius: '8px',
                p: '12px',
                cursor: 'pointer',
                backgroundColor:
                  importMode === 'replace'
                    ? 'rgba(25, 118, 210, 0.04)'
                    : 'transparent',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                },
              }}
              onClick={() => setImportMode('replace')}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}>
                <Box>
                  <Typography
                    sx={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                    }}>
                    {t('label.replace-entire-contract')}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '12px',
                      color: theme.palette.text.secondary,
                      lineHeight: '20px',
                    }}>
                    {t('message.import-mode-replace-description')}
                  </Typography>
                </Box>
                <Radio
                  checked={importMode === 'replace'}
                  sx={{ p: 0 }}
                  value="replace"
                />
              </Box>
            </Box>
          </RadioGroup>
        </FormControl>
      </Box>
    );
  }, [hasExistingContract, importMode, handleImportModeChange, t, theme]);

  const renderObjectSelector = useCallback(() => {
    if (!isODCSFormat || schemaObjects.length <= 1) {
      return null;
    }

    return (
      <Box className="object-selector-section">
        <Box className="object-selector-header">
          <Typography
            component="span"
            data-testid="multi-object-contract-detected"
            sx={{ fontSize: '14px', fontWeight: 600 }}>
            {t('message.multi-object-contract-detected')}
          </Typography>
        </Box>
        <Box className="object-selector-content">
          <FormControl fullWidth>
            <Select
              displayEmpty
              fullWidth
              data-testid="schema-object-select"
              value={selectedObjectName}
              onChange={handleObjectSelectChange}>
              <MenuItem disabled value="">
                {t('label.select-schema-object')}
              </MenuItem>
              {schemaObjects.map((obj) => (
                <MenuItem
                  data-testid={`schema-object-option-${obj}`}
                  key={obj}
                  sx={{ px: '12px' }}
                  value={obj}>
                  {obj}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>
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
    <Dialog
      data-testid="import-contract-modal"
      open={visible}
      slotProps={{
        paper: {
          className: 'odcs-import-modal',
          sx: {
            borderRadius: '8px',
            width: yamlContent ? 900 : 680,
            maxWidth: '100%',
          },
        },
      }}
      onClose={isLoading ? undefined : handleReset}>
      <DialogTitle
        data-testid="import-contract-modal-title"
        sx={{
          '&.MuiDialogTitle-root': {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '24px 24px 16px 24px',
            boxShadow: yamlContent
              ? '0 4px 6px -1px rgba(10, 13, 18, 0.10), 0 2px 4px -2px rgba(10, 13, 18, 0.06)'
              : 'none',
          },
        }}>
        <Box>
          <Typography
            sx={{ fontSize: '14px', fontWeight: 600, lineHeight: '20px' }}>
            {isODCSFormat
              ? t('label.import-odcs-contract')
              : t('label.import-contract')}
          </Typography>
          <Typography
            color="textSecondary"
            sx={{ fontSize: '14px', lineHeight: '20px', mt: '4px' }}>
            {t('message.upload-file-description')}
          </Typography>
        </Box>
        {!isLoading && (
          <IconButton size="medium" sx={{ p: 0 }} onClick={handleReset}>
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent sx={{ px: '20px', pt: 0, pb: '20px' }}>
        <Box
          className="import-content-wrapper"
          sx={{
            minHeight: yamlContent ? '400px' : 'auto',
            marginTop: yamlContent ? '16px' : '0',
            overflow: 'scroll',
          }}>
          <Box className="source-panel">
            {!yamlContent ? (
              <Box
                sx={{
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: '8px',
                  py: '16px',
                  px: '24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: isDragging
                    ? theme.palette.action.hover
                    : 'transparent',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
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
                  htmlFor="file-upload-input"
                  style={{ cursor: 'pointer', display: 'block' }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '8px',
                      border: `1px solid ${theme.palette.divider}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: '12px',
                    }}>
                    <CloudUpload height={20} width={20} />
                  </Box>
                  <Typography sx={{ fontSize: '14px', lineHeight: '20px' }}>
                    <Typography
                      component="span"
                      sx={{
                        color: theme.palette.primary.main,
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: 'pointer',
                      }}>
                      {t('label.click-to-upload')}
                    </Typography>{' '}
                    {t('label.or-drag-and-drop')}
                  </Typography>
                  <Typography
                    color="textSecondary"
                    sx={{ fontSize: '12px', lineHeight: '18px', mt: '4px' }}>
                    {t('label.supports-yaml-format')}
                  </Typography>
                </label>
              </Box>
            ) : (
              <>
                <Box className="file-info-card" data-testid="file-info-card">
                  <Box className="file-info">
                    <DescriptionOutlinedIcon className="file-icon" />

                    <Typography className="file-name" component="span">
                      {fileName}
                    </Typography>
                  </Box>

                  <IconButton
                    className="remove-button"
                    size="small"
                    title="Delete file"
                    onClick={handleRemoveFile}>
                    <DeleteOutlineOutlined fontSize="small" />
                  </IconButton>
                </Box>

                {renderObjectSelector()}
                {renderContractPreview()}
                {renderImportOptions()}
              </>
            )}
          </Box>

          {yamlContent && (
            <Box
              className="validation-panel"
              sx={{
                backgroundColor: parseError
                  ? theme.palette.allShades.error[50]
                  : theme.palette.grey[50],
              }}>
              {renderValidationPanel()}
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: '20px', py: '16px', gap: '12px' }}>
        <Button
          data-testid="cancel-button"
          disabled={isLoading}
          sx={{
            fontSize: '14px',
            fontWeight: 600,
            textTransform: 'none',
            px: '14px',
            py: '8px',
          }}
          variant="text"
          onClick={handleReset}>
          {t('label.cancel')}
        </Button>
        <Button
          data-testid="import-button"
          disabled={isImportDisabled || isLoading}
          sx={{
            fontSize: '14px',
            fontWeight: 600,
            textTransform: 'none',
            px: '14px',
            py: '8px',
          }}
          variant="contained"
          onClick={handleImport}>
          {(isLoading || isValidating) && (
            <CircularProgress color="inherit" size={16} sx={{ mr: 1 }} />
          )}
          {t('label.import')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ContractImportModal;
