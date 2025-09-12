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
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new-thick.svg';
import { ReactComponent as EmptyContractIcon } from '../../../assets/svg/empty-contract.svg';
import { ReactComponent as FlagIcon } from '../../../assets/svg/flag.svg';
import { ReactComponent as ExportIcon } from '../../../assets/svg/ic-export-box.svg';
import { ReactComponent as FailIcon } from '../../../assets/svg/ic-fail.svg';
import { ReactComponent as SettingIcon } from '../../../assets/svg/ic-settings-v1.svg';
import { ReactComponent as CheckIcon } from '../../../assets/svg/ic-successful.svg';
import { ReactComponent as DefaultIcon } from '../../../assets/svg/ic-task.svg';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-trash.svg';

import { ReactComponent as RunIcon } from '../../../assets/svg/ic-circle-pause.svg';

import {
  CONTRACT_ACTION_DROPDOWN_KEY,
  DataContractMode,
} from '../../../constants/DataContract.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import {
  getContractResultByResultId,
  validateContractById,
} from '../../../rest/contractAPI';
import {
  downloadContractYamlFile,
  getConstraintStatus,
} from '../../../utils/DataContract/DataContractUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { pruneEmptyChildren } from '../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolderNew from '../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import StatusBadgeV2 from '../../common/StatusBadge/StatusBadgeV2.component';
import ContractExecutionChart from '../ContractExecutionChart/ContractExecutionChart.component';
import ContractQualityCard from '../ContractQualityCard/ContractQualityCard.component';
import ContractSchemaTable from '../ContractSchemaTable/ContractSchemaTabe.component';
import ContractSLA from '../ContractSLACard/ContractSLA.component';
import ContractViewSwitchTab from '../ContractViewSwitchTab/ContractViewSwitchTab.component';
import ContractYaml from '../ContractYaml/ContractYaml.component';
import './contract-detail.less';

const ContractDetail: React.FC<{
  contract?: DataContract | null;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ contract, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const [validateLoading, setValidateLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [latestContractResults, setLatestContractResults] =
    useState<DataContractResult>();
  const [mode, setMode] = useState<DataContractMode>(DataContractMode.UI);

  const fetchLatestContractResults = async () => {
    try {
      setIsLoading(true);
      const results = await getContractResultByResultId(
        contract?.id || '',
        contract?.latestResult?.resultId || ''
      );
      setLatestContractResults(results);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
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

  //   const showContractStatusAlert = useMemo(() => {
  //     const { result, contractExecutionStatus } = latestContractResults ?? {};

  //     return (
  //       result &&
  //       (contractExecutionStatus === ContractExecutionStatus.Failed ||
  //         contractExecutionStatus === ContractExecutionStatus.Aborted)
  //     );
  //   }, [latestContractResults]);

  const contractActionsItems: MenuProps['items'] = useMemo(() => {
    return [
      {
        label: (
          <div
            className="contract-action-dropdown-item"
            data-testid="edit-contract-button">
            <Icon component={EditIcon} />

            {t('label.edit')}
          </div>
        ),
        key: CONTRACT_ACTION_DROPDOWN_KEY.EDIT,
      },
      {
        label: (
          <div
            className="contract-action-dropdown-item"
            data-testid="delete-contract-button">
            <Icon component={RunIcon} />

            {t('label.run-now')}
          </div>
        ),
        key: CONTRACT_ACTION_DROPDOWN_KEY.RUN_NOW,
      },
      {
        label: (
          <div
            className="contract-action-dropdown-item"
            data-testid="export-contract-button">
            <Icon component={ExportIcon} />

            {t('label.export')}
          </div>
        ),
        key: CONTRACT_ACTION_DROPDOWN_KEY.EXPORT,
      },
      {
        type: 'divider',
      },
      {
        label: (
          <div
            className="contract-action-dropdown-item contract-action-dropdown-delete-item"
            data-testid="delete-contract-button">
            <Icon component={DeleteIcon} />

            {t('label.delete')}
          </div>
        ),
        key: CONTRACT_ACTION_DROPDOWN_KEY.DELETE,
      },
    ];
  }, []);

  const getSemanticIconPerLastExecution = (semanticName: string) => {
    if (!latestContractResults) {
      return DefaultIcon;
    }
    const isRuleFailed =
      latestContractResults?.semanticsValidation?.failedRules?.find(
        (rule) => rule.ruleName === semanticName
      );

    if (isRuleFailed) {
      return FailIcon;
    }

    return CheckIcon;
  };

  const handleExportContract = useCallback(() => {
    if (!contract) {
      return;
    }

    downloadContractYamlFile(contract);
  }, [contract]);

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

  const handleContractAction = useCallback(
    (item: MenuInfo) => {
      switch (item.key) {
        case CONTRACT_ACTION_DROPDOWN_KEY.RUN_NOW:
          return handleRunNow();

        case CONTRACT_ACTION_DROPDOWN_KEY.EXPORT:
          return handleExportContract();

        case CONTRACT_ACTION_DROPDOWN_KEY.DELETE:
          return onDelete();

        default:
          return onEdit();
      }
    },
    [onDelete, onEdit, handleRunNow, handleExportContract]
  );

  const handleModeChange = useCallback((e: RadioChangeEvent) => {
    setMode(e.target.value);
  }, []);

  const renderDataContractHeader = useMemo(() => {
    if (!contract) {
      return null;
    }

    return (
      <Row align="middle" justify="space-between">
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
              //   getPopupContainer={(triggerNode) => triggerNode.parentElement!}
              menu={{
                items: contractActionsItems,
                onClick: handleContractAction,
              }}
              overlayClassName="contract-action-dropdown"
              overlayStyle={{ width: 150 }}
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
              externalIcon={FlagIcon}
              label={contract.entityStatus ?? t('label.approved')}
              status={StatusType.Success}
            />
          </div>
        </Col>
      </Row>
    );
  }, [contract, mode, handleRunNow, handleModeChange, validateLoading]);

  useEffect(() => {
    if (contract?.id && contract?.latestResult?.resultId) {
      fetchLatestContractResults();
    }
  }, [contract]);

  if (!contract) {
    return (
      <ErrorPlaceHolderNew
        icon={
          <EmptyContractIcon className="empty-contract-icon" height={140} />
        }
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <Typography.Paragraph className="m-t-md w-80" type="secondary">
          {t('message.create-contract-description')}
        </Typography.Paragraph>

        <Button
          className="m-t-md"
          data-testid="add-contract-button"
          icon={<PlusOutlined />}
          type="primary"
          onClick={onEdit}>
          {t('label.add-entity', { entity: t('label.contract') })}
        </Button>
      </ErrorPlaceHolderNew>
    );
  }

  return (
    <Card
      className="contract-header-container"
      style={{ marginBottom: 16 }}
      title={renderDataContractHeader}>
      {mode === DataContractMode.YAML ? (
        <ContractYaml contract={contract} />
      ) : (
        <Row className="contract-detail-container">
          <Col className="contract-card-items" span={24}>
            <div className="contract-card-header-container">
              <Typography.Text className="contract-card-header">
                {t('label.description')}
              </Typography.Text>
              <Divider dashed />
            </div>

            <RichTextEditorPreviewerV1
              enableSeeMoreVariant
              markdown={contract.description ?? ''}
            />
          </Col>

          <Col className="contract-card-items" span={24}>
            <div className="contract-card-header-container">
              <Typography.Text className="contract-card-header">
                {t('label.terms-of-service')}
              </Typography.Text>
              <Divider dashed />
            </div>

            <RichTextEditorPreviewerV1
              enableSeeMoreVariant
              markdown={contract.termsOfUse ?? ''}
            />
          </Col>

          <Col className="contract-card-items" span={24}>
            <div className="contract-card-header-container">
              <Typography.Text className="contract-card-header">
                {t('label.service-level-agreement')}
              </Typography.Text>
              <Divider dashed />
            </div>

            <ContractSLA contract={contract} />
          </Col>

          {!isEmpty(schemaDetail) && (
            <Col
              className="contract-card-items"
              data-testid="schema-table-card"
              span={24}>
              <div className="contract-card-header-container">
                <Typography.Text className="contract-card-header">
                  {t('label.schema')}
                </Typography.Text>
                <Divider dashed />
              </div>

              <ContractSchemaTable
                contractStatus={constraintStatus['schema']}
                schemaDetail={schemaDetail}
              />
            </Col>
          )}

          {/* Semantics Card */}
          {contract?.semantics && contract?.semantics.length > 0 && (
            <Col
              className="contract-card-items"
              data-testid="schema-table-card"
              span={24}>
              <div className="contract-card-header-container">
                <Typography.Text className="contract-card-header">
                  {t('label.semantic-plural')}
                </Typography.Text>
                <Divider dashed />
              </div>

              <div className="rule-item-container">
                {(contract?.semantics ?? []).map((item) => (
                  <div className="rule-item">
                    <Icon
                      className={classNames('rule-icon', {
                        'rule-icon-default': !latestContractResults,
                      })}
                      component={getSemanticIconPerLastExecution(item.name)}
                    />
                    <span className="rule-name">{item.name}</span>
                  </div>
                ))}
              </div>
            </Col>
          )}

          {/* Quality Card */}
          {contract?.testSuite?.id && (
            <Col
              className="contract-card-items"
              data-testid="schema-table-card"
              span={24}>
              <div className="contract-card-header-container">
                <Typography.Text className="contract-card-header">
                  {t('label.quality')}
                </Typography.Text>
                <Divider dashed />
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
                <Divider dashed />
              </div>

              <ContractExecutionChart contract={contract} />
            </Col>
          )}
        </Row>
      )}
    </Card>
  );
};

export { ContractDetail };
