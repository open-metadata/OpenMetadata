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
import Icon, { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Divider,
  Dropdown,
  MenuProps,
  RadioChangeEvent,
  Row,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import approvedIcon from '../../../assets/img/approved.png';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new-thick.svg';
import { ReactComponent as EmptyContractIcon } from '../../../assets/svg/empty-contract.svg';
import { ReactComponent as FlagIcon } from '../../../assets/svg/flag.svg';
import { ReactComponent as RunIcon } from '../../../assets/svg/ic-circle-pause.svg';
import { ReactComponent as ExportIcon } from '../../../assets/svg/ic-export-box.svg';
import { ReactComponent as ImportIcon } from '../../../assets/svg/ic-import.svg';
import { ReactComponent as SettingIcon } from '../../../assets/svg/ic-settings-gear.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-trash.svg';
import {
  ContractImportFormat,
  CONTRACT_DATE_TIME_FORMAT,
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
  validateContractById,
} from '../../../rest/contractAPI';
import { isDescriptionContentEmpty } from '../../../utils/BlockEditorUtils';
import {
  downloadContractAsODCSYaml,
  downloadContractYamlFile,
  getConstraintStatus,
} from '../../../utils/DataContract/DataContractUtils';
import { customFormatDateTime } from '../../../utils/date-time/DateTimeUtils';
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

  const addContractActionsItems: MenuProps['items'] = useMemo(() => {
    return [
      {
        label: (
          <div
            className="contract-action-dropdown-item"
            data-testid="create-contract-button">
            <PlusOutlined className="anticon" />

            {t('label.create-entity', { entity: t('label.contract') })}
          </div>
        ),
        key: DATA_CONTRACT_ACTION_DROPDOWN_KEY.CREATE,
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
    ];
  }, []);

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
            className="contract-action-dropdown-item contract-action-dropdown-delete-item"
            data-testid="delete-contract-button">
            <DeleteIcon className="anticon" />

            {t('label.delete')}
          </div>
        ),
        key: DATA_CONTRACT_ACTION_DROPDOWN_KEY.DELETE,
      },
    ];
  }, []);

  const handleExportContract = useCallback(() => {
    if (!contract) {
      return;
    }

    downloadContractYamlFile(contract);
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
    if (contract?.id) {
      try {
        setValidateLoading(true);
        await validateContractById(contract.id);
        showSuccessToast(t('message.contract-validation-trigger-successfully'));
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setValidateLoading(false);
      }
    }
  };

  const handleAddContractAction = useCallback(
    (item: MenuInfo) => {
      switch (item.key) {
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
            <Typography.Text
              className="contract-title"
              data-testid="contract-title">
              {getEntityName(contract)}
            </Typography.Text>
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
                  icon={<Icon component={SettingIcon} />}
                  title={t('label.contract')}
                  type="text"
                />
              </Dropdown>
            </div>
          </Col>
          <Col className="d-flex items-center gap-2" span={24}>
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
                    {customFormatDateTime(
                      contract.createdAt,
                      CONTRACT_DATE_TIME_FORMAT
                    )}
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

          <Dropdown
            destroyPopupOnHide
            getPopupContainer={getPopupContainer}
            menu={{
              items: addContractActionsItems,
              onClick: handleAddContractAction,
            }}
            overlayClassName="contract-action-dropdown"
            overlayStyle={{ width: 180 }}
            placement="bottom"
            trigger={['click']}>
            <Button
              className="m-t-md"
              data-testid="add-contract-button"
              icon={<PlusOutlined />}
              type="primary">
              {t('label.add-entity', { entity: t('label.contract') })}
            </Button>
          </Dropdown>
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
                  defafultExpand
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
            {!isDescriptionContentEmpty(contract.termsOfUse ?? '') && (
              <Col className="contract-card-items" span={24}>
                <div className="contract-card-header-container">
                  <Typography.Text className="contract-card-header">
                    {t('label.terms-of-service')}
                  </Typography.Text>
                  <Divider className="contract-dash-separator" />
                </div>

                <RichTextEditorPreviewerV1
                  enableSeeMoreVariant
                  markdown={contract.termsOfUse ?? ''}
                />
              </Col>
            )}

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
            {!isEmpty(contract.security) && (
              <Col
                className="contract-card-items"
                data-testid="security-card"
                span={24}>
                <div className="contract-card-header-container">
                  <Typography.Text className="contract-card-header">
                    {t('label.security')}
                  </Typography.Text>
                  <Divider className="contract-dash-separator" />
                </div>

                <ContractSecurityCard security={contract.security} />
              </Col>
            )}

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
