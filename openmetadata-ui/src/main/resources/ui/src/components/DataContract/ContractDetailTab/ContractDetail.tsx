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
  BadgeWithIcon,
  Box,
  Button,
  ButtonUtility,
  Card,
  Divider,
  Dropdown,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  Download02,
  Flag04,
  PlayCircle,
  Plus,
  Trash01,
  Upload01,
} from '@untitledui/icons';
import type { RadioChangeEvent } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import approvedIcon from '../../../assets/img/approved.png';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as EmptyContractIcon } from '../../../assets/svg/empty-contract.svg';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import { ReactComponent as SettingIcon } from '../../../assets/svg/ic-settings-gear.svg';
import { ReactComponent as ImportIconContract } from '../../../assets/svg/import-icon.svg';

import {
  ContractImportFormat,
  DataContractMode,
  DATA_CONTRACT_ACTION_DROPDOWN_KEY,
} from '../../../constants/DataContract.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import { ContractExecutionStatus } from '../../../generated/type/contractExecutionStatus';
import {
  exportContractToODCSYaml,
  getContractResultByResultId,
  validateContractByEntityId,
  validateContractById,
} from '../../../rest/contractAPI';
import { isDescriptionContentEmpty } from '../../../utils/BlockEditorUtils';
import {
  downloadContractAsODCSYaml,
  downloadContractYamlFile,
  getConstraintStatus,
} from '../../../utils/DataContract/DataContractUtils';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { pruneEmptyChildren } from '../../../utils/TablePureUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import AlertBar from '../../AlertBar/AlertBar';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import ContractExecutionChart from '../ContractExecutionChart/ContractExecutionChart.component';
import ContractQualityCard from '../ContractQualityCard/ContractQualityCard.component';
import ContractSchemaTable from '../ContractSchemaTable/ContractSchemaTable.component';
import ContractSemantics from '../ContractSemantics/ContractSemantics.component';
import ContractSLA from '../ContractSLACard/ContractSLA.component';
import ContractViewSwitchTab from '../ContractViewSwitchTab/ContractViewSwitchTab.component';
import ContractYaml from '../ContractYaml/ContractYaml.component';
import './contract-detail.less';

const ContractSecurityCard = withSuspenseFallback(
  lazy(() => import('../ContractSecurity/ContractSecurityCard.component'))
);

const ContractImportModal = withSuspenseFallback(
  lazy(() => import('../ODCSImportModal'))
);

interface TermsOfUse {
  content?: string;
  inherited?: boolean;
}

interface ContractWithInheritance extends Omit<DataContract, 'termsOfUse'> {
  termsOfUse?: TermsOfUse | string;
}

const ContractDetail: React.FC<{
  contract?: DataContract | null;
  entityId: string;
  entityType: string;
  entityName?: string;
  hasEditPermission?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onContractUpdated?: () => void;
}> = ({
  contract,
  entityId,
  entityType,
  entityName,
  hasEditPermission = false,
  onEdit,
  onDelete,
  onContractUpdated,
}) => {
  const { t } = useTranslation();
  const [validateLoading, setValidateLoading] = useState(false);
  const [latestContractResults, setLatestContractResults] =
    useState<DataContractResult>();
  const [mode, setMode] = useState<DataContractMode>(DataContractMode.UI);
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importFormat, setImportFormat] =
    useState<ContractImportFormat>('odcs');

  const fetchLatestContractResults = async () => {
    try {
      const results = await getContractResultByResultId(
        contract?.id || '',
        contract?.latestResult?.resultId || ''
      );
      setLatestContractResults(results);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  };

  const schemaDetail = useMemo(() => {
    return pruneEmptyChildren(contract?.schema || []);
  }, [contract?.schema]);

  const constraintStatus = useMemo(() => {
    if (!latestContractResults) {
      return {};
    }

    return getConstraintStatus(latestContractResults);
  }, [latestContractResults]);

  const showContractStatusAlert = useMemo(() => {
    const { result, contractExecutionStatus } = latestContractResults ?? {};

    return (
      result &&
      (contractExecutionStatus === ContractExecutionStatus.Failed ||
        contractExecutionStatus === ContractExecutionStatus.Aborted)
    );
  }, [latestContractResults]);

  const isInheritedContract = Boolean(contract?.inherited);

  const handleExportContract = useCallback(() => {
    if (!contract) {
      return;
    }
    try {
      downloadContractYamlFile(contract);
      showSuccessToast(
        t('message.entity-exported-successfully', {
          entity: t('label.contract'),
        })
      );
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [contract]);

  const handleExportODCSContract = useCallback(async () => {
    if (!contract?.id) {
      return;
    }

    try {
      const yamlContent = await exportContractToODCSYaml(contract.id);
      downloadContractAsODCSYaml(yamlContent, contract.name ?? 'contract');
      showSuccessToast(
        t('message.entity-exported-successfully', {
          entity: t('label.odcs-contract'),
        })
      );
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [contract]);

  const handleImportContract = useCallback((format: ContractImportFormat) => {
    setImportFormat(format);
    setIsImportModalVisible(true);
  }, []);

  const handleImportModalClose = useCallback(() => {
    setIsImportModalVisible(false);
  }, []);

  const handleImportSuccess = useCallback(() => {
    setIsImportModalVisible(false);
    onContractUpdated?.();
  }, [onContractUpdated]);

  const handleRunNow = async () => {
    if (!contract) {
      return;
    }

    try {
      setValidateLoading(true);
      // Use entity-based validation for inherited contracts to materialize and store results
      if (isInheritedContract && contract.entity?.id && contract.entity?.type) {
        await validateContractByEntityId(
          contract.entity.id,
          contract.entity.type
        );
      } else if (contract.id) {
        await validateContractById(contract.id);
      }
      showSuccessToast(t('message.contract-validation-trigger-successfully'));
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setValidateLoading(false);
    }
  };

  const handleAddContractAction = useCallback(
    (key: string) => {
      switch (key) {
        case DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_ODCS:
          return handleImportContract('odcs');

        case DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_OPENMETADATA:
          return handleImportContract('openmetadata');

        case DATA_CONTRACT_ACTION_DROPDOWN_KEY.CREATE:
        default:
          return onEdit();
      }
    },
    [onEdit, handleImportContract]
  );

  const handleContractAction = useCallback(
    (key: string) => {
      switch (key) {
        case DATA_CONTRACT_ACTION_DROPDOWN_KEY.RUN_NOW:
          return handleRunNow();

        case DATA_CONTRACT_ACTION_DROPDOWN_KEY.EXPORT:
          return handleExportContract();

        case DATA_CONTRACT_ACTION_DROPDOWN_KEY.EXPORT_ODCS:
          return handleExportODCSContract();

        case DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_ODCS:
          return handleImportContract('odcs');

        case DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_OPENMETADATA:
          return handleImportContract('openmetadata');

        case DATA_CONTRACT_ACTION_DROPDOWN_KEY.DELETE:
          return onDelete();

        default:
          return onEdit();
      }
    },
    [
      onDelete,
      onEdit,
      handleRunNow,
      handleExportContract,
      handleExportODCSContract,
      handleImportContract,
    ]
  );

  const handleModeChange = useCallback((e: RadioChangeEvent) => {
    setMode(e.target.value);
  }, []);

  const renderDataContractHeader = useMemo(() => {
    if (!contract) {
      return null;
    }

    return (
      <Box
        align="center"
        className="tw:w-full tw:px-6 tw:py-4"
        data-testid="contract-header-container"
        gap={4}>
        <img
          alt={t('label.approved-entity', {
            entity: t('label.contract'),
          })}
          className="contract-status-img"
          height={90}
          src={approvedIcon}
          width={90}
        />
        <Box className="tw:w-full" direction="col" gap={1}>
          <Box align="center" className="tw:w-full" gap={1} justify="between">
            <Box align="center" gap={1}>
              <div className="tw:max-w-125">
                <Typography
                  ellipsis
                  data-testid="contract-title"
                  size="text-lg"
                  weight="semibold">
                  {getEntityName(contract)}
                </Typography>
              </div>
              {(contract as ContractWithInheritance & { inherited?: boolean })
                .inherited && (
                <Tooltip
                  title={t('label.inherited-entity', {
                    entity: t('label.contract'),
                  })}>
                  <TooltipTrigger>
                    <ButtonUtility
                      color="tertiary"
                      icon={
                        <InheritIcon
                          className="inherit-icon cursor-pointer"
                          width={16}
                        />
                      }
                      size="sm"
                    />
                  </TooltipTrigger>
                </Tooltip>
              )}
            </Box>
            <Box align="center" gap={3}>
              <ContractViewSwitchTab
                handleModeChange={handleModeChange}
                mode={mode}
              />

              <Dropdown.Root>
                <ButtonUtility
                  className="contract-action-button"
                  color="tertiary"
                  data-testid="manage-contract-actions"
                  icon={<SettingIcon height={20} width={20} />}
                />

                <Dropdown.Popover placement="bottom right">
                  <Dropdown.Menu
                    className="tw:min-w-45"
                    data-testid="contract-action-dropdown"
                    onAction={(key) => handleContractAction(String(key))}>
                    {hasEditPermission && (
                      <>
                        <Dropdown.Item
                          data-testid="contract-edit-button"
                          id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.EDIT}>
                          <Box align="center" gap={2}>
                            <EditIcon
                              aria-hidden="true"
                              className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
                            />
                            <Typography
                              ellipsis
                              className="tw:grow tw:text-gray-700"
                              size="text-sm">
                              {t('label.edit')}
                            </Typography>
                          </Box>
                        </Dropdown.Item>
                        <Dropdown.Item
                          data-testid="contract-run-now-button"
                          icon={PlayCircle}
                          id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.RUN_NOW}
                          label={t('label.run-now')}
                        />
                        <Dropdown.Item
                          data-testid="import-openmetadata-contract-button"
                          icon={Download02}
                          id={
                            DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_OPENMETADATA
                          }
                          label={t('label.import')}
                        />
                        <Dropdown.Item
                          data-testid="import-odcs-contract-button"
                          icon={Download02}
                          id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_ODCS}
                          label={t('label.import-odcs')}
                        />
                      </>
                    )}
                    <Dropdown.Item
                      data-testid="export-contract-button"
                      icon={Upload01}
                      id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.EXPORT}
                      label={t('label.export')}
                    />
                    <Dropdown.Item
                      data-testid="export-odcs-contract-button"
                      icon={Upload01}
                      id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.EXPORT_ODCS}
                      label={t('label.export-odcs')}
                    />
                    {hasEditPermission && (
                      <>
                        <Dropdown.Separator />
                        <Dropdown.Item
                          data-testid="delete-contract-button"
                          id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.DELETE}
                          isDisabled={isInheritedContract}>
                          <Box align="center" gap={2}>
                            <Trash01
                              aria-hidden="true"
                              className="tw:size-4 tw:shrink-0 tw:stroke-[2.25px] tw:text-error-600"
                            />
                            <Typography
                              ellipsis
                              className="tw:grow tw:text-error-600"
                              size="text-sm"
                              weight="medium">
                              {t('label.delete')}
                            </Typography>
                          </Box>
                        </Dropdown.Item>
                      </>
                    )}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.Root>
            </Box>
          </Box>
          <Box align="center" className="tw:w-full" gap={2} wrap="wrap">
            {contract.createdBy && (
              <>
                <Box align="center" gap={2}>
                  <Typography data-testid="contract-created-by-label">
                    {`${t('label.created-by')} : `}
                  </Typography>

                  <OwnerLabel
                    owners={[
                      { name: contract.createdBy, type: 'user', id: '' },
                    ]}
                  />
                </Box>

                <Divider
                  className="tw:self-center tw:h-4.5 tw:mx-2"
                  orientation="vertical"
                />
              </>
            )}

            {contract.createdAt && (
              <>
                <Box align="center" gap={2}>
                  <Typography data-testid="contract-created-at-label">
                    {`${t('label.created-at')} : `}
                  </Typography>

                  <Typography data-testid="contract-created-at-value">
                    {formatDateTime(contract.createdAt)}
                  </Typography>
                </Box>

                <Divider
                  className="tw:self-center tw:h-4.5 tw:mx-2"
                  orientation="vertical"
                />
              </>
            )}

            <Box align="center" gap={2}>
              <Typography data-testid="contract-version-label">
                {`${t('label.version')} : `}
              </Typography>

              <Badge color="purple" size="sm" type="pill-color">
                {String(contract.version)}
              </Badge>
            </Box>

            <Divider
              className="tw:self-center tw:h-4.5 tw:mx-2"
              orientation="vertical"
            />

            <Box align="center" gap={2}>
              <Typography data-testid="contract-status-label">
                {`${t('label.status')} : `}
              </Typography>

              <BadgeWithIcon
                color="success"
                iconLeading={Flag04}
                size="sm"
                type="pill-color">
                {contract.entityStatus ?? t('label.approved')}
              </BadgeWithIcon>
            </Box>

            <Divider
              className="tw:self-center tw:h-4.5 tw:mx-2"
              orientation="vertical"
            />

            <Box align="center" data-testid="contract-owner-card" gap={2}>
              <Typography data-testid="contract-status-label">
                {`${t('label.owner-plural')} : `}
              </Typography>

              <OwnerLabel
                avatarSize={24}
                isCompactView={false}
                maxVisibleOwners={5}
                owners={contract.owners}
                showLabel={false}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }, [contract, mode, handleRunNow, handleModeChange, validateLoading]);

  useEffect(() => {
    if (contract?.id && contract?.latestResult?.resultId) {
      fetchLatestContractResults();
    }
  }, [contract]);

  if (!contract) {
    if (!hasEditPermission) {
      return (
        <ErrorPlaceHolder
          icon={
            <EmptyContractIcon className="empty-contract-icon" height={140} />
          }
          type={ERROR_PLACEHOLDER_TYPE.CORE_CREATE}>
          <Typography as="p" className="m-t-md w-80 tw:text-secondary">
            {t('message.no-contract-description')}
          </Typography>
        </ErrorPlaceHolder>
      );
    }

    return (
      <>
        <ContractImportModal
          entityId={entityId}
          entityName={entityName}
          entityType={entityType}
          existingContract={null}
          format={importFormat}
          visible={isImportModalVisible}
          onClose={handleImportModalClose}
          onSuccess={handleImportSuccess}
        />
        <ErrorPlaceHolder
          icon={
            <EmptyContractIcon className="empty-contract-icon" height={140} />
          }
          type={ERROR_PLACEHOLDER_TYPE.CORE_CREATE}>
          <div className="tw:my-4">
            <Typography as="p" className="w-80 tw:text-gray-500 tw:text-center">
              {t('message.create-contract-description')}
            </Typography>
          </div>

          <Dropdown.Root>
            <Button
              className="tw:mt-2"
              color="primary"
              data-testid="add-contract-button"
              iconTrailing={ChevronDown}
              size="sm">
              {t('label.add-entity', { entity: t('label.contract') })}
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                data-testid="add-contract-menu"
                onAction={(key) => handleAddContractAction(String(key))}>
                <Dropdown.Item
                  data-testid="create-contract-button"
                  icon={Plus}
                  id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.CREATE}
                  label={t('label.create-contract-with-ui')}
                />
                <Dropdown.Item
                  data-testid="import-openmetadata-contract-button"
                  id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_OPENMETADATA}>
                  <Box align="center" gap={2}>
                    <ImportIconContract
                      aria-hidden="true"
                      className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
                    />
                    <Typography
                      ellipsis
                      className="tw:grow tw:text-gray-700"
                      size="text-sm">
                      {t('label.import-om')}
                    </Typography>
                  </Box>
                </Dropdown.Item>
                <Dropdown.Item
                  data-testid="import-odcs-contract-button"
                  id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_ODCS}>
                  <Box align="center" gap={2}>
                    <ImportIconContract
                      aria-hidden="true"
                      className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
                    />
                    <Typography
                      ellipsis
                      className="tw:grow tw:text-gray-700"
                      size="text-sm">
                      {t('label.import-odcs')}
                    </Typography>
                  </Box>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.Root>
        </ErrorPlaceHolder>
      </>
    );
  }

  return (
    <>
      <ContractImportModal
        entityId={entityId}
        entityName={entityName}
        entityType={entityType}
        existingContract={contract}
        format={importFormat}
        visible={isImportModalVisible}
        onClose={handleImportModalClose}
        onSuccess={handleImportSuccess}
      />
      <Card className="tw:mb-4">
        {renderDataContractHeader}
        <Card.Content>
          {mode === DataContractMode.YAML ? (
            <ContractYaml contract={contract} />
          ) : (
            <div className="contract-detail-container">
              {showContractStatusAlert && (
                <div className="contract-card-items">
                  <AlertBar
                    defaultExpand
                    className="h-full"
                    message={latestContractResults?.result ?? ''}
                    type="error"
                  />
                </div>
              )}

              {!isDescriptionContentEmpty(contract.description ?? '') && (
                <div className="contract-card-items">
                  <div className="contract-card-header-container">
                    <Typography as="span" className="contract-card-header">
                      {t('label.description')}
                    </Typography>
                    <Divider className="tw:border-b-2 tw:border-dotted tw:border-gray-200 tw:bg-transparent" />
                  </div>

                  <RichTextEditorPreviewerV1
                    enableSeeMoreVariant
                    markdown={contract.description ?? ''}
                  />
                </div>
              )}

              {(() => {
                const contractWithInheritance =
                  contract as ContractWithInheritance;
                const termsOfUse = contractWithInheritance?.termsOfUse;
                const termsContent =
                  typeof termsOfUse === 'string'
                    ? termsOfUse
                    : termsOfUse?.content ?? '';
                const isInherited =
                  typeof termsOfUse === 'object' && termsOfUse?.inherited;

                if (isDescriptionContentEmpty(termsContent)) {
                  return null;
                }

                const inheritedIcon = isInherited ? (
                  <Tooltip
                    title={t('label.inherited-entity', {
                      entity: t('label.terms-of-service'),
                    })}>
                    <TooltipTrigger>
                      <ButtonUtility
                        color="tertiary"
                        icon={
                          <InheritIcon
                            className="inherit-icon cursor-pointer"
                            width={16}
                          />
                        }
                        size="sm"
                      />
                    </TooltipTrigger>
                  </Tooltip>
                ) : null;

                return (
                  <div className="contract-card-items">
                    <div className="contract-card-header-container">
                      <Box align="center" gap={1}>
                        <Typography as="span" className="contract-card-header">
                          {t('label.terms-of-service')}
                        </Typography>
                        {inheritedIcon}
                      </Box>
                      <Divider className="tw:border-b-2 tw:border-dotted tw:border-gray-200 tw:bg-transparent" />
                    </div>

                    <RichTextEditorPreviewerV1
                      enableSeeMoreVariant
                      markdown={termsContent}
                    />
                  </div>
                );
              })()}

              <ContractSLA contract={contract} />

              {!isEmpty(schemaDetail) && (
                <div
                  className="contract-card-items"
                  data-testid="schema-table-card">
                  <div className="contract-card-header-container">
                    <Typography as="span" className="contract-card-header">
                      {t('label.schema')}
                    </Typography>
                    <Divider className="tw:border-b-2 tw:border-dotted tw:border-gray-200 tw:bg-transparent" />
                  </div>

                  <ContractSchemaTable
                    contractStatus={constraintStatus['schema']}
                    latestSchemaValidationResult={
                      latestContractResults?.schemaValidation
                    }
                    schemaDetail={schemaDetail}
                  />
                </div>
              )}

              {!isEmpty(contract.security) &&
                (() => {
                  const inheritedIcon = contract.security?.inherited ? (
                    <Tooltip
                      title={t('label.inherited-entity', {
                        entity: t('label.security'),
                      })}>
                      <TooltipTrigger>
                        <ButtonUtility
                          color="tertiary"
                          icon={
                            <InheritIcon
                              className="inherit-icon cursor-pointer"
                              width={16}
                            />
                          }
                          size="sm"
                        />
                      </TooltipTrigger>
                    </Tooltip>
                  ) : null;

                  return (
                    <div
                      className="contract-card-items"
                      data-testid="security-card">
                      <div className="contract-card-header-container">
                        <Box align="center" gap={1}>
                          <Typography
                            as="span"
                            className="contract-card-header">
                            {t('label.security')}
                          </Typography>
                          {inheritedIcon}
                        </Box>
                        <Divider className="tw:border-b-2 tw:border-dotted tw:border-gray-200 tw:bg-transparent" />
                      </div>

                      <ContractSecurityCard security={contract.security} />
                    </div>
                  );
                })()}

              {contract?.semantics && contract?.semantics.length > 0 && (
                <div
                  className="contract-card-items"
                  data-testid="semantics-card">
                  <div className="contract-card-header-container">
                    <Typography as="span" className="contract-card-header">
                      {t('label.semantic-plural')}
                    </Typography>
                    <Divider className="tw:border-b-2 tw:border-dotted tw:border-gray-200 tw:bg-transparent" />
                  </div>

                  <ContractSemantics
                    contractStatus={constraintStatus['semantic']}
                    latestContractResults={latestContractResults}
                    semantics={contract?.semantics}
                  />
                </div>
              )}

              {contract?.testSuite?.id && (
                <div
                  className="contract-card-items"
                  data-testid="data-quality-card">
                  <div className="contract-card-header-container">
                    <Typography as="span" className="contract-card-header">
                      {t('label.quality')}
                    </Typography>
                    <Divider className="tw:border-b-2 tw:border-dotted tw:border-gray-200 tw:bg-transparent" />
                  </div>

                  <ContractQualityCard
                    contract={contract}
                    contractStatus={constraintStatus['quality']}
                  />
                </div>
              )}

              {contract.id && contract.latestResult?.resultId && (
                <div
                  className="contract-card-items"
                  data-testid="schema-table-card">
                  <div className="contract-card-header-container">
                    <Typography as="span" className="contract-card-header">
                      {t('label.execution-history')}
                    </Typography>
                    <Divider className="tw:border-b-2 tw:border-dotted tw:border-gray-200 tw:bg-transparent" />
                  </div>

                  <ContractExecutionChart contract={contract} />
                </div>
              )}
            </div>
          )}
        </Card.Content>
      </Card>
    </>
  );
};

export { ContractDetail };
