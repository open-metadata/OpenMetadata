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
import { Button, Dropdown, Tooltip } from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  Download01,
  Edit01,
  Play,
  Plus,
  Settings01,
  Trash01,
  Upload01,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import approvedIcon from '../../../assets/img/approved.png';
import { ReactComponent as EmptyContractIcon } from '../../../assets/svg/empty-contract.svg';
import { ReactComponent as FlagIcon } from '../../../assets/svg/flag.svg';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import {
  ContractImportFormat,
  DATA_CONTRACT_ACTION_DROPDOWN_KEY,
  DataContractMode,
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
import { getEntityName } from '../../../utils/EntityUtils';
import { pruneEmptyChildren } from '../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import AlertBar from '../../AlertBar/AlertBar';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import StatusBadgeV2 from '../../common/StatusBadge/StatusBadgeV2.component';
import ContractExecutionChart from '../ContractExecutionChart/ContractExecutionChart.component';
import ContractQualityCard from '../ContractQualityCard/ContractQualityCard.component';
import ContractSchemaTable from '../ContractSchemaTable/ContractSchemaTable.component';
import ContractSecurityCard from '../ContractSecurity/ContractSecurityCard.component';
import ContractSemantics from '../ContractSemantics/ContractSemantics.component';
import ContractSLA from '../ContractSLACard/ContractSLA.component';
import ContractViewSwitchTab from '../ContractViewSwitchTab/ContractViewSwitchTab.component';
import ContractYaml from '../ContractYaml/ContractYaml.component';
import ContractImportModal from '../ODCSImportModal';
import './contract-detail.less';

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
    (key: string | number) => {
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
    (key: string | number) => {
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

  const handleModeChange = useCallback(
    (e: { target: { value: DataContractMode } }) => {
      setMode(e.target.value);
    },
    []
  );

  const renderDataContractHeader = useMemo(() => {
    if (!contract) {
      return null;
    }

    return (
      <div className="contract-header-container">
        <img
          alt={t('label.approved-entity', {
            entity: t('label.contract'),
          })}
          className="contract-status-img"
          src={approvedIcon}
        />
        <div className="d-flex flex-wrap items-center justify-between gap-1 w-full">
          <div className="tw:flex-1">
            <div className="d-flex items-center gap-2">
              <span className="contract-title" data-testid="contract-title">
                {getEntityName(contract)}
              </span>
              {(contract as ContractWithInheritance & { inherited?: boolean })
                .inherited && (
                <Tooltip
                  title={t('label.inherited-entity', {
                    entity: t('label.contract'),
                  })}>
                  <button
                    className="tw:inline-flex tw:cursor-pointer tw:border-0 tw:bg-transparent tw:p-0"
                    type="button">
                    <InheritIcon className="inherit-icon" width={16} />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
          <div className="d-flex justify-end">
            <div className="contract-action-container">
              <ContractViewSwitchTab
                handleModeChange={handleModeChange}
                mode={mode}
              />

              <Dropdown.Root>
                <Button
                  className="contract-action-button"
                  color="secondary"
                  data-testid="manage-contract-actions"
                  iconLeading={Settings01}
                  size="sm"
                />
                <Dropdown.Popover className="tw:w-auto">
                  <Dropdown.Menu onAction={handleContractAction}>
                    {hasEditPermission ? (
                      <Dropdown.Item
                        data-testid="contract-edit-button"
                        icon={Edit01}
                        id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.EDIT}
                        label={t('label.edit')}
                      />
                    ) : null}
                    {hasEditPermission ? (
                      <Dropdown.Item
                        data-testid="contract-run-now-button"
                        icon={Play}
                        id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.RUN_NOW}
                        label={t('label.run-now')}
                      />
                    ) : null}
                    {hasEditPermission ? (
                      <Dropdown.Item
                        data-testid="import-openmetadata-contract-button"
                        icon={Download01}
                        id={
                          DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_OPENMETADATA
                        }
                        label={t('label.import')}
                      />
                    ) : null}
                    {hasEditPermission ? (
                      <Dropdown.Item
                        data-testid="import-odcs-contract-button"
                        icon={Download01}
                        id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_ODCS}
                        label={t('label.import-odcs')}
                      />
                    ) : null}
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
                    {hasEditPermission ? <Dropdown.Separator /> : null}
                    {hasEditPermission ? (
                      <Dropdown.Item
                        className="contract-delete-item"
                        data-testid="delete-contract-button"
                        icon={Trash01}
                        id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.DELETE}
                        isDisabled={isInheritedContract}
                        label={t('label.delete')}
                      />
                    ) : null}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.Root>
            </div>
          </div>
          <div className="d-flex items-center gap-2 flex-wrap w-full">
            {contract.createdBy && (
              <>
                <div className="d-flex items-center">
                  <span
                    className="contract-sub-header-title"
                    data-testid="contract-created-by-label">
                    {`${t('label.created-by')} : `}
                  </span>

                  <OwnerLabel
                    owners={[
                      { name: contract.createdBy, type: 'user', id: '' },
                    ]}
                  />
                </div>

                <span className="self-center contract-vertical-divider" />
              </>
            )}

            {contract.createdAt && (
              <>
                <div className="d-flex items-center">
                  <span
                    className="contract-sub-header-title"
                    data-testid="contract-created-at-label">
                    {`${t('label.created-at')} : `}
                  </span>

                  <span
                    className="contract-sub-header-value"
                    data-testid="contract-created-at-value">
                    {formatDateTime(contract.createdAt)}
                  </span>
                </div>

                <span className="self-center contract-vertical-divider" />
              </>
            )}

            <div className="d-flex items-center">
              <span
                className="contract-sub-header-title"
                data-testid="contract-version-label">
                {`${t('label.version')} : `}
              </span>

              <StatusBadgeV2
                className="contract-version-badge"
                label={String(contract.version)}
                status={StatusType.Version}
              />
            </div>

            <span className="self-center contract-vertical-divider" />

            <div className="d-flex items-center">
              <span
                className="contract-sub-header-title"
                data-testid="contract-status-label">
                {`${t('label.status')} : `}
              </span>

              <StatusBadgeV2
                className="contract-success-badge"
                externalIcon={FlagIcon}
                label={contract.entityStatus ?? t('label.approved')}
                status={StatusType.Success}
              />
            </div>

            <span className="self-center contract-vertical-divider" />

            <div
              className="d-flex items-center"
              data-testid="contract-owner-card">
              <span
                className="contract-sub-header-title"
                data-testid="contract-status-label">
                {`${t('label.owner-plural')} : `}
              </span>

              <OwnerLabel
                avatarSize={24}
                isCompactView={false}
                maxVisibleOwners={5}
                owners={contract.owners}
                showLabel={false}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }, [
    contract,
    mode,
    handleRunNow,
    handleModeChange,
    validateLoading,
    hasEditPermission,
    isInheritedContract,
    handleContractAction,
    t,
  ]);

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
          type={ERROR_PLACEHOLDER_TYPE.MUI_CREATE}>
          <p className="m-t-md w-80 tw:text-secondary">
            {t('message.no-contract-description')}
          </p>
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
          type={ERROR_PLACEHOLDER_TYPE.MUI_CREATE}>
          <p className="m-t-md w-80 tw:text-secondary">
            {t('message.create-contract-description')}
          </p>

          <Dropdown.Root>
            <Button
              color="primary"
              data-testid="add-contract-button"
              iconTrailing={ChevronDown}
              id="add-contract-button">
              {t('label.add-entity', { entity: t('label.contract') })}
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                data-testid="add-contract-menu"
                id="add-contract-menu"
                onAction={(key) => handleAddContractAction(key)}>
                <Dropdown.Item
                  data-testid="create-contract-button"
                  icon={Plus}
                  id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.CREATE}
                  label={t('label.create-contract-with-ui')}
                />
                <Dropdown.Item
                  data-testid="import-openmetadata-contract-button"
                  icon={Download01}
                  id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_OPENMETADATA}
                  label={t('label.import-om')}
                />
                <Dropdown.Item
                  data-testid="import-odcs-contract-button"
                  icon={Download01}
                  id={DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_ODCS}
                  label={t('label.import-odcs')}
                />
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
      <div
        className="contract-card-container tw:border tw:border-border-secondary tw:rounded-lg tw:bg-primary"
        style={{ marginBottom: 16 }}>
        <div className="contract-card-head">
          <div className="contract-card-head-title">
            {renderDataContractHeader}
          </div>
        </div>
        <div className="contract-card-body">
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
                    <span className="contract-card-header">
                      {t('label.description')}
                    </span>
                    <hr className="contract-dash-separator" />
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
                    <button
                      className="tw:inline-flex tw:cursor-pointer tw:border-0 tw:bg-transparent tw:p-0"
                      type="button">
                      <InheritIcon className="inherit-icon" width={14} />
                    </button>
                  </Tooltip>
                ) : null;

                return (
                  <div className="contract-card-items">
                    <div className="contract-card-header-container">
                      <div className="d-flex items-center gap-1">
                        <span className="contract-card-header">
                          {t('label.terms-of-service')}
                        </span>
                        {inheritedIcon}
                      </div>
                      <hr className="contract-dash-separator" />
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
                    <span className="contract-card-header">
                      {t('label.schema')}
                    </span>
                    <hr className="contract-dash-separator" />
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
                      <button
                        className="tw:inline-flex tw:cursor-pointer tw:border-0 tw:bg-transparent tw:p-0"
                        type="button">
                        <InheritIcon className="inherit-icon" width={14} />
                      </button>
                    </Tooltip>
                  ) : null;

                  return (
                    <div
                      className="contract-card-items"
                      data-testid="security-card">
                      <div className="contract-card-header-container">
                        <div className="d-flex items-center gap-1">
                          <span className="contract-card-header">
                            {t('label.security')}
                          </span>
                          {inheritedIcon}
                        </div>
                        <hr className="contract-dash-separator" />
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
                    <span className="contract-card-header">
                      {t('label.semantic-plural')}
                    </span>
                    <hr className="contract-dash-separator" />
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
                    <span className="contract-card-header">
                      {t('label.quality')}
                    </span>
                    <hr className="contract-dash-separator" />
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
                    <span className="contract-card-header">
                      {t('label.execution-history')}
                    </span>
                    <hr className="contract-dash-separator" />
                  </div>

                  <ContractExecutionChart contract={contract} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export { ContractDetail };
