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
import Icon from '@ant-design/icons';
import { AddOutlined, ExpandMore } from '@mui/icons-material';
import { Button, Menu, MenuItem } from '@mui/material';
import {
  Card,
  Col,
  Divider,
  Dropdown,
  MenuProps,
  RadioChangeEvent,
  Row,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import type { MenuInfo } from 'rc-menu/lib/interface';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import approvedIcon from '../../../assets/img/approved.png';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new-thick.svg';
import { ReactComponent as EmptyContractIcon } from '../../../assets/svg/empty-contract.svg';
import { ReactComponent as FlagIcon } from '../../../assets/svg/flag.svg';
import { ReactComponent as RunIcon } from '../../../assets/svg/ic-circle-pause.svg';
import { ReactComponent as ExportIcon } from '../../../assets/svg/ic-export-box.svg';
import { ReactComponent as ImportIcon } from '../../../assets/svg/ic-import.svg';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import { ReactComponent as SettingIcon } from '../../../assets/svg/ic-settings-gear.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-trash.svg';
import { ReactComponent as ImportIconSelected } from '../../../assets/svg/import-icon-selected.svg';
import { ReactComponent as ImportIconContract } from '../../../assets/svg/import-icon.svg';
import { PRIMARY_COLOR } from '../../../constants/Color.constants';
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
import { getEntityName } from '../../../utils/EntityUtils';
import { getPopupContainer } from '../../../utils/formUtils';
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
  onEdit: () => void;
  onDelete: () => void;
  onContractUpdated?: () => void;
}> = ({
  contract,
  entityId,
  entityType,
  entityName,
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
  const [addContractMenuAnchor, setAddContractMenuAnchor] =
    useState<null | HTMLElement>(null);
  const [hoveredAddContractItem, setHoveredAddContractItem] = useState<
    string | null
  >(null);

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
  const addContractActionsItems = useMemo(() => {
    return [
      {
        label: t('label.create-contract-with-ui'),
        key: DATA_CONTRACT_ACTION_DROPDOWN_KEY.CREATE,
        icon: (
          <AddOutlined
            sx={{
              color:
                hoveredAddContractItem ===
                DATA_CONTRACT_ACTION_DROPDOWN_KEY.CREATE
                  ? PRIMARY_COLOR
                  : 'inherit',
            }}
          />
        ),
        testId: 'create-contract-button',
      },
      {
        label: t('label.import-om'),
        key: DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_OPENMETADATA,
        icon:
          hoveredAddContractItem ===
          DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_OPENMETADATA ? (
            <ImportIconSelected />
          ) : (
            <ImportIconContract />
          ),
        testId: 'import-openmetadata-contract-button',
      },
      {
        label: t('label.import-odcs'),
        key: DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_ODCS,
        icon:
          hoveredAddContractItem ===
          DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_ODCS ? (
            <ImportIconSelected />
          ) : (
            <ImportIconContract />
          ),
        testId: 'import-odcs-contract-button',
      },
    ];
  }, [t, hoveredAddContractItem]);

  const contractActionsItems: MenuProps['items'] = useMemo(() => {
    return [
      {
        label: (
          <div
            className="contract-action-dropdown-item"
            data-testid="contract-edit-button">
            <EditIcon className="anticon" />

            {t('label.edit')}
          </div>
        ),
        key: DATA_CONTRACT_ACTION_DROPDOWN_KEY.EDIT,
      },
      {
        label: (
          <div
            className="contract-action-dropdown-item"
            data-testid="contract-run-now-button">
            <RunIcon className="anticon" />

            {t('label.run-now')}
          </div>
        ),
        key: DATA_CONTRACT_ACTION_DROPDOWN_KEY.RUN_NOW,
      },
      {
        label: (
          <div
            className="contract-action-dropdown-item"
            data-testid="import-openmetadata-contract-button">
            <ImportIcon className="anticon" />

            {t('label.import')}
          </div>
        ),
        key: DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_OPENMETADATA,
      },
      {
        label: (
          <div
            className="contract-action-dropdown-item"
            data-testid="import-odcs-contract-button">
            <ImportIcon className="anticon" />

            {t('label.import-odcs')}
          </div>
        ),
        key: DATA_CONTRACT_ACTION_DROPDOWN_KEY.IMPORT_ODCS,
      },
      {
        label: (
          <div
            className="contract-action-dropdown-item"
            data-testid="export-contract-button">
            <ExportIcon className="anticon" />

            {t('label.export')}
          </div>
        ),
        key: DATA_CONTRACT_ACTION_DROPDOWN_KEY.EXPORT,
      },
      {
        label: (
          <div
            className="contract-action-dropdown-item"
            data-testid="export-odcs-contract-button">
            <ExportIcon className="anticon" />

            {t('label.export-odcs')}
          </div>
        ),
        key: DATA_CONTRACT_ACTION_DROPDOWN_KEY.EXPORT_ODCS,
      },
      {
        type: 'divider',
      },
      {
        label: (
          <div
            className={`contract-action-dropdown-item contract-action-dropdown-delete-item ${
              isInheritedContract ? 'disabled' : ''
            }`}
            data-testid="delete-contract-button"
            title={
              isInheritedContract
                ? t('message.inherited-contract-cannot-be-deleted')
                : undefined
            }>
            <DeleteIcon className="anticon" />

            {t('label.delete')}
          </div>
        ),
        key: DATA_CONTRACT_ACTION_DROPDOWN_KEY.DELETE,
        disabled: isInheritedContract,
      },
    ];
  }, [isInheritedContract]);

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

  const handleAddContractMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAddContractMenuAnchor(event.currentTarget);
  };

  const handleAddContractMenuClose = () => {
    setAddContractMenuAnchor(null);
  };

  const handleAddContractAction = useCallback(
    (key: string) => {
      handleAddContractMenuClose();
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
    (item: MenuInfo) => {
      switch (item.key) {
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
      <div className="contract-header-container">
        <img
          alt={t('label.approved-entity', {
            entity: t('label.contract'),
          })}
          className="contract-status-img"
          src={approvedIcon}
        />
        <Row
          align="middle"
          className="w-full"
          gutter={[0, 4]}
          justify="space-between">
          <Col span={20}>
            <div className="d-flex items-center gap-2">
              <Typography.Text
                className="contract-title"
                data-testid="contract-title">
                {getEntityName(contract)}
              </Typography.Text>
              {(contract as ContractWithInheritance & { inherited?: boolean })
                .inherited && (
                <Tooltip
                  title={t('label.inherited-entity', {
                    entity: t('label.contract'),
                  })}>
                  <InheritIcon
                    className="inherit-icon cursor-pointer"
                    width={16}
                  />
                </Tooltip>
              )}
            </div>
          </Col>
          <Col className="d-flex justify-end" span={4}>
            <div className="contract-action-container">
              <ContractViewSwitchTab
                handleModeChange={handleModeChange}
                mode={mode}
              />

              <Dropdown
                destroyPopupOnHide
                getPopupContainer={getPopupContainer}
                menu={{
                  items: contractActionsItems,
                  onClick: handleContractAction,
                }}
                overlayClassName="contract-action-dropdown"
                overlayStyle={{ width: 180 }}
                placement="bottomRight"
                trigger={['click']}>
                <Button
                  className="contract-action-button"
                  data-testid="manage-contract-actions"
                  startIcon={<Icon component={SettingIcon} />}
                  title={t('label.contract')}
                  variant="text"
                />
              </Dropdown>
            </div>
          </Col>
          <Col className="d-flex items-center gap-2 flex-wrap" span={24}>
            {contract.createdBy && (
              <>
                <div className="d-flex items-center">
                  <Typography.Text
                    className="contract-sub-header-title"
                    data-testid="contract-created-by-label">
                    {`${t('label.created-by')} : `}
                  </Typography.Text>

                  <OwnerLabel
                    owners={[
                      { name: contract.createdBy, type: 'user', id: '' },
                    ]}
                  />
                </div>

                <Divider
                  className="self-center vertical-divider"
                  type="vertical"
                />
              </>
            )}

            {contract.createdAt && (
              <>
                <div className="d-flex items-center">
                  <Typography.Text
                    className="contract-sub-header-title"
                    data-testid="contract-created-at-label">
                    {`${t('label.created-at')} : `}
                  </Typography.Text>

                  <Typography.Text
                    className="contract-sub-header-value"
                    data-testid="contract-created-at-value">
                    {formatDateTime(contract.createdAt)}
                  </Typography.Text>
                </div>

                <Divider
                  className="self-center vertical-divider"
                  type="vertical"
                />
              </>
            )}

            <div className="d-flex items-center">
              <Typography.Text
                className="contract-sub-header-title"
                data-testid="contract-version-label">
                {`${t('label.version')} : `}
              </Typography.Text>

              <StatusBadgeV2
                className="contract-version-badge"
                label={String(contract.version)}
                status={StatusType.Version}
              />
            </div>

            <Divider className="self-center vertical-divider" type="vertical" />

            <div className="d-flex items-center">
              <Typography.Text
                className="contract-sub-header-title"
                data-testid="contract-status-label">
                {`${t('label.status')} : `}
              </Typography.Text>

              <StatusBadgeV2
                className="contract-success-badge"
                externalIcon={FlagIcon}
                label={contract.entityStatus ?? t('label.approved')}
                status={StatusType.Success}
              />
            </div>

            <Divider className="self-center vertical-divider" type="vertical" />

            <div
              className="d-flex items-center"
              data-testid="contract-owner-card">
              <Typography.Text
                className="contract-sub-header-title"
                data-testid="contract-status-label">
                {`${t('label.owner-plural')} : `}
              </Typography.Text>

              <OwnerLabel
                avatarSize={24}
                isCompactView={false}
                maxVisibleOwners={5}
                owners={contract.owners}
                showLabel={false}
              />
            </div>
          </Col>
        </Row>
      </div>
    );
  }, [contract, mode, handleRunNow, handleModeChange, validateLoading]);

  useEffect(() => {
    if (contract?.id && contract?.latestResult?.resultId) {
      fetchLatestContractResults();
    }
  }, [contract]);

  if (!contract) {
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
          <Typography.Paragraph className="m-t-md w-80" type="secondary">
            {t('message.create-contract-description')}
          </Typography.Paragraph>

          <>
            <Button
              aria-controls={
                addContractMenuAnchor ? 'add-contract-menu' : undefined
              }
              aria-expanded={addContractMenuAnchor ? 'true' : 'false'}
              aria-haspopup="true"
              data-testid="add-contract-button"
              endIcon={<ExpandMore />}
              id="add-contract-button"
              sx={{ marginTop: 2 }}
              variant="contained"
              onClick={handleAddContractMenuOpen}>
              {t('label.add-entity', { entity: t('label.contract') })}
            </Button>
            <Menu
              anchorEl={addContractMenuAnchor}
              aria-labelledby="add-contract-button"
              data-testid="add-contract-menu"
              id="add-contract-menu"
              open={Boolean(addContractMenuAnchor)}
              sx={{
                '& .MuiPaper-root': {
                  borderRadius: '8px',
                  border: '1px solid var(--grey-15)',
                  boxShadow: 'var(--button-box-shadow-default)',
                  whiteSpace: 'nowrap',
                  width: 'auto',
                  minWidth: 'auto',
                },

                '& .MuiMenu-list': {
                  padding: 0,
                },

                '& .MuiMenuItem-root': {
                  padding: '10px 0',
                  minHeight: 'auto',
                  margin: 0,

                  '& .contract-action-dropdown-item': {
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--grey-700)',
                    padding: '0 16px',

                    '& svg': {
                      width: '16px',
                      height: '16px',
                      color: 'var(--grey-700)',
                    },
                  },

                  '&:hover': {
                    backgroundColor: '#f5faff',

                    '& .contract-action-dropdown-item': {
                      color: '#1570ef',

                      '& svg': {
                        color: '#1570ef',
                      },
                    },
                  },
                },
              }}
              onClose={handleAddContractMenuClose}>
              {addContractActionsItems.map((item) => (
                <MenuItem
                  data-testid={item.testId}
                  key={item.key}
                  onClick={() => handleAddContractAction(item.key as string)}
                  onMouseEnter={() => setHoveredAddContractItem(item.key)}
                  onMouseLeave={() => setHoveredAddContractItem(null)}>
                  <span className="contract-action-dropdown-item">
                    {item.icon}
                    {item.label}
                  </span>
                </MenuItem>
              ))}
            </Menu>
          </>
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
      <Card
        className="contract-card-container"
        style={{ marginBottom: 16 }}
        title={renderDataContractHeader}>
        {mode === DataContractMode.YAML ? (
          <ContractYaml contract={contract} />
        ) : (
          <Row className="contract-detail-container">
            {showContractStatusAlert && (
              <Col className="contract-card-items" span={24}>
                <AlertBar
                  defaultExpand
                  className="h-full"
                  message={latestContractResults?.result ?? ''}
                  type="error"
                />
              </Col>
            )}

            {/* Description Component */}
            {!isDescriptionContentEmpty(contract.description ?? '') && (
              <Col className="contract-card-items" span={24}>
                <div className="contract-card-header-container">
                  <Typography.Text className="contract-card-header">
                    {t('label.description')}
                  </Typography.Text>
                  <Divider className="contract-dash-separator" />
                </div>

                <RichTextEditorPreviewerV1
                  enableSeeMoreVariant
                  markdown={contract.description ?? ''}
                />
              </Col>
            )}

            {/* Terms of Use Component */}
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
                  <InheritIcon
                    className="inherit-icon cursor-pointer"
                    width={14}
                  />
                </Tooltip>
              ) : null;

              return (
                <Col className="contract-card-items" span={24}>
                  <div className="contract-card-header-container">
                    <div className="d-flex items-center gap-1">
                      <Typography.Text className="contract-card-header">
                        {t('label.terms-of-service')}
                      </Typography.Text>
                      {inheritedIcon}
                    </div>
                    <Divider className="contract-dash-separator" />
                  </div>

                  <RichTextEditorPreviewerV1
                    enableSeeMoreVariant
                    markdown={termsContent}
                  />
                </Col>
              );
            })()}

            {/* SLA Component */}
            <ContractSLA contract={contract} />

            {/* Schema Component */}
            {!isEmpty(schemaDetail) && (
              <Col
                className="contract-card-items"
                data-testid="schema-table-card"
                span={24}>
                <div className="contract-card-header-container">
                  <Typography.Text className="contract-card-header">
                    {t('label.schema')}
                  </Typography.Text>
                  <Divider className="contract-dash-separator" />
                </div>

                <ContractSchemaTable
                  contractStatus={constraintStatus['schema']}
                  latestSchemaValidationResult={
                    latestContractResults?.schemaValidation
                  }
                  schemaDetail={schemaDetail}
                />
              </Col>
            )}

            {/* Security Component */}
            {!isEmpty(contract.security) &&
              (() => {
                const inheritedIcon = contract.security?.inherited ? (
                  <Tooltip
                    title={t('label.inherited-entity', {
                      entity: t('label.security'),
                    })}>
                    <InheritIcon
                      className="inherit-icon cursor-pointer"
                      width={14}
                    />
                  </Tooltip>
                ) : null;

                return (
                  <Col
                    className="contract-card-items"
                    data-testid="security-card"
                    span={24}>
                    <div className="contract-card-header-container">
                      <div className="d-flex items-center gap-1">
                        <Typography.Text className="contract-card-header">
                          {t('label.security')}
                        </Typography.Text>
                        {inheritedIcon}
                      </div>
                      <Divider className="contract-dash-separator" />
                    </div>

                    <ContractSecurityCard security={contract.security} />
                  </Col>
                );
              })()}

            {/* Semantics Component */}
            {contract?.semantics && contract?.semantics.length > 0 && (
              <Col
                className="contract-card-items"
                data-testid="semantics-card"
                span={24}>
                <div className="contract-card-header-container">
                  <Typography.Text className="contract-card-header">
                    {t('label.semantic-plural')}
                  </Typography.Text>
                  <Divider className="contract-dash-separator" />
                </div>

                <ContractSemantics
                  contractStatus={constraintStatus['semantic']}
                  latestContractResults={latestContractResults}
                  semantics={contract?.semantics}
                />
              </Col>
            )}

            {/* Quality Component */}
            {contract?.testSuite?.id && (
              <Col
                className="contract-card-items"
                data-testid="data-quality-card"
                span={24}>
                <div className="contract-card-header-container">
                  <Typography.Text className="contract-card-header">
                    {t('label.quality')}
                  </Typography.Text>
                  <Divider className="contract-dash-separator" />
                </div>

                <ContractQualityCard
                  contract={contract}
                  contractStatus={constraintStatus['quality']}
                />
              </Col>
            )}

            {/* Contract Execution Chart */}
            {contract.id && contract.latestResult?.resultId && (
              <Col
                className="contract-card-items"
                data-testid="schema-table-card"
                span={24}>
                <div className="contract-card-header-container">
                  <Typography.Text className="contract-card-header">
                    {t('label.execution-history')}
                  </Typography.Text>
                  <Divider className="contract-dash-separator" />
                </div>

                <ContractExecutionChart contract={contract} />
              </Col>
            )}
          </Row>
        )}
      </Card>
    </>
  );
};

export { ContractDetail };
