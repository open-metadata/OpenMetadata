/*
 *  Copyright 2023 Collate.
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

import { CheckOutlined } from '@ant-design/icons';
import { Button, Popover, Table, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import cronstrue from 'cronstrue';
import { isEmpty, isNil } from 'lodash';
import React, { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { PAGE_SIZE } from '../../constants/constants';
import { WORKFLOWS_METADATA_DOCS } from '../../constants/docs.constants';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getLoadingStatus } from '../../utils/CommonUtils';
import {
  getEditIngestionPath,
  getLogsViewerPath,
} from '../../utils/RouterUtils';
import { showSuccessToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../common/next-previous/NextPrevious';
import Loader from '../Loader/Loader';
import KillIngestionModal from '../Modals/KillIngestionPipelineModal/KillIngestionPipelineModal';
import { IngestionListTableProps } from './ingestion.interface';
import { IngestionRecentRuns } from './IngestionRecentRun/IngestionRecentRuns.component';

function IngestionListTable({
  airflowEndpoint,
  triggerIngestion,
  deployIngestion,
  isRequiredDetailsAvailable,
  paging,
  pagingHandler,
  handleEnableDisableIngestion,
  currentPage,
  onIngestionWorkflowsUpdate,
  servicePermission,
  serviceCategory,
  serviceName,
  handleDeleteSelection,
  handleIsConfirmationModalOpen,
  ingestionData,
  deleteSelection,
  permissions,
  pipelineNameColWidth,
}: IngestionListTableProps) {
  const history = useHistory();
  const { t } = useTranslation();
  const [currTriggerId, setCurrTriggerId] = useState({ id: '', state: '' });
  const [currDeployId, setCurrDeployId] = useState({ id: '', state: '' });
  const [selectedPipeline, setSelectedPipeline] = useState<IngestionPipeline>();
  const [isKillModalOpen, setIsKillModalOpen] = useState<boolean>(false);

  const getEditPermission = (service: string): boolean =>
    !servicePermission?.[service]?.EditAll;

  const handleTriggerIngestion = (id: string, displayName: string) => {
    setCurrTriggerId({ id, state: 'waiting' });
    triggerIngestion(id, displayName)
      .then(() => {
        setCurrTriggerId({ id, state: 'success' });
        setTimeout(() => {
          setCurrTriggerId({ id: '', state: '' });
          showSuccessToast(t('message.pipeline-trigger-success-message'));
        }, 1500);
      })
      .catch(() => setCurrTriggerId({ id: '', state: '' }));
  };

  const handleDeployIngestion = (id: string) => {
    setCurrDeployId({ id, state: 'waiting' });
    deployIngestion(id)
      .then(() => {
        setCurrDeployId({ id, state: 'success' });
        setTimeout(() => setCurrDeployId({ id: '', state: '' }), 1500);
      })
      .catch(() => setCurrDeployId({ id: '', state: '' }));
  };

  const handleUpdate = (ingestion: IngestionPipeline) => {
    history.push(
      getEditIngestionPath(
        serviceCategory,
        serviceName,
        ingestion.fullyQualifiedName || `${serviceName}.${ingestion.name}`,
        ingestion.pipelineType
      )
    );
  };

  const ConfirmDelete = (id: string, name: string) => {
    handleDeleteSelection({
      id,
      name,
      state: '',
    });
    handleIsConfirmationModalOpen(true);
  };

  const separator = (
    <span className="tw-inline-block tw-text-gray-400 tw-self-center">|</span>
  );

  const getIngestionPermission = (name: string): boolean =>
    !isRequiredDetailsAvailable || getEditPermission(name);

  const getTriggerDeployButton = (ingestion: IngestionPipeline) => {
    if (ingestion.deployed) {
      return (
        <>
          <Button
            data-testid="run"
            disabled={getIngestionPermission(ingestion.name)}
            type="link"
            onClick={() =>
              handleTriggerIngestion(ingestion.id as string, ingestion.name)
            }>
            {getLoadingStatus(currTriggerId, ingestion.id, t('label.run'))}
          </Button>
          {separator}

          <Button
            data-testid="re-deploy-btn"
            disabled={getIngestionPermission(ingestion.name)}
            type="link"
            onClick={() => handleDeployIngestion(ingestion.id as string)}>
            {getLoadingStatus(currDeployId, ingestion.id, t('label.re-deploy'))}
          </Button>
        </>
      );
    } else {
      return (
        <Button
          data-testid="deploy"
          disabled={getIngestionPermission(ingestion.name)}
          type="link"
          onClick={() => handleDeployIngestion(ingestion.id as string)}>
          {getLoadingStatus(currDeployId, ingestion.id, t('label.deploy'))}
        </Button>
      );
    }
  };

  const tableColumn: ColumnsType<IngestionPipeline> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: pipelineNameColWidth ?? 500,
        render: (text, record) =>
          airflowEndpoint ? (
            <Tooltip
              title={
                permissions.ViewAll || permissions.ViewBasic
                  ? t('label.view-entity', {
                      entity: t('label.dag'),
                    })
                  : t('message.no-permission-to-view')
              }>
              <Typography.Link
                className="tw-mr-2 overflow-wrap-anywhere"
                data-testid="airflow-tree-view"
                disabled={!(permissions.ViewAll || permissions.ViewBasic)}
                href={`${airflowEndpoint}/tree?dag_id=${text}`}
                rel="noopener noreferrer"
                target="_blank">
                {getEntityName(record)}
              </Typography.Link>
            </Tooltip>
          ) : (
            getEntityName(record)
          ),
      },
      {
        title: t('label.type'),
        dataIndex: 'pipelineType',
        key: 'pipelineType',
      },
      {
        title: t('label.schedule'),
        dataIndex: 'schedule',
        key: 'schedule',
        render: (_, record) =>
          record.airflowConfig?.scheduleInterval ? (
            <Popover
              content={
                <div>
                  {cronstrue.toString(
                    record.airflowConfig.scheduleInterval || '',
                    {
                      use24HourTimeFormat: true,
                      verbose: true,
                    }
                  )}
                </div>
              }
              placement="bottom"
              trigger="hover">
              <span>{record.airflowConfig.scheduleInterval ?? '--'}</span>
            </Popover>
          ) : (
            <span>--</span>
          ),
      },
      {
        title: t('label.recent-run-plural'),
        dataIndex: 'recentRuns',
        key: 'recentRuns',
        width: 180,
        render: (_, record) => (
          <IngestionRecentRuns classNames="align-middle" ingestion={record} />
        ),
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        render: (_, record) => (
          <div>
            <div className="tw-flex">
              {record.enabled ? (
                <Fragment>
                  {getTriggerDeployButton(record)}
                  {separator}
                  <Button
                    data-testid="pause"
                    disabled={getIngestionPermission(record.name)}
                    type="link"
                    onClick={() =>
                      handleEnableDisableIngestion(record.id || '')
                    }>
                    {t('label.pause')}
                  </Button>
                </Fragment>
              ) : (
                <Button
                  data-testid="unpause"
                  disabled={getIngestionPermission(record.name)}
                  type="link"
                  onClick={() => handleEnableDisableIngestion(record.id || '')}>
                  {t('label.unpause')}
                </Button>
              )}
              {separator}
              <Button
                data-testid="edit"
                disabled={getIngestionPermission(record.name)}
                type="link"
                onClick={() => handleUpdate(record)}>
                {t('label.edit')}
              </Button>
              {separator}
              <Button
                data-testid="delete"
                disabled={!servicePermission?.[record.name]?.Delete}
                type="link"
                onClick={() => ConfirmDelete(record.id as string, record.name)}>
                {deleteSelection.id === record.id ? (
                  deleteSelection.state === 'success' ? (
                    <CheckOutlined />
                  ) : (
                    <Loader size="small" type="default" />
                  )
                ) : (
                  t('label.delete')
                )}
              </Button>
              {separator}
              <Button
                data-testid="kill"
                disabled={getIngestionPermission(record.name)}
                type="link"
                onClick={() => {
                  setIsKillModalOpen(true);
                  setSelectedPipeline(record);
                }}>
                {t('label.kill')}
              </Button>
              {separator}
              <Button
                data-testid="logs"
                disabled={!isRequiredDetailsAvailable}
                href={getLogsViewerPath(
                  serviceCategory,
                  record.service?.name || '',
                  record?.fullyQualifiedName || record?.name || ''
                )}
                type="link"
                onClick={() => {
                  setSelectedPipeline(record);
                }}>
                {t('label.log-plural')}
              </Button>
            </div>
            {isKillModalOpen &&
              selectedPipeline &&
              record.id === selectedPipeline?.id && (
                <KillIngestionModal
                  isModalOpen={isKillModalOpen}
                  pipelinName={selectedPipeline.name}
                  pipelineId={selectedPipeline.id as string}
                  onClose={() => {
                    setIsKillModalOpen(false);
                    setSelectedPipeline(undefined);
                  }}
                  onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
                />
              )}
          </div>
        ),
      },
    ],
    [
      permissions,
      airflowEndpoint,
      getTriggerDeployButton,
      isRequiredDetailsAvailable,
      handleEnableDisableIngestion,
      ConfirmDelete,
      handleUpdate,
      deleteSelection,
      setIsKillModalOpen,
      setSelectedPipeline,
      getLogsViewerPath,
      serviceCategory,
      isKillModalOpen,
      selectedPipeline,
      onIngestionWorkflowsUpdate,
      ingestionData,
    ]
  );

  return !isEmpty(ingestionData) ? (
    <div className="tw-mb-6" data-testid="ingestion-table">
      <Table
        bordered
        className="table-shadow"
        columns={tableColumn}
        data-testid="schema-table"
        dataSource={ingestionData}
        pagination={false}
        rowKey="name"
        size="small"
      />

      {Boolean(!isNil(paging.after) || !isNil(paging.before)) && (
        <NextPrevious
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          paging={paging}
          pagingHandler={pagingHandler}
          totalCount={paging.total}
        />
      )}
    </div>
  ) : isRequiredDetailsAvailable && ingestionData.length === 0 ? (
    <ErrorPlaceHolder>
      <Typography.Text>{t('message.no-ingestion-available')}</Typography.Text>
      <Typography.Text>{t('message.no-ingestion-description')}</Typography.Text>
      <Typography.Link href={WORKFLOWS_METADATA_DOCS} target="_blank">
        {t('label.metadata-ingestion')}
      </Typography.Link>
    </ErrorPlaceHolder>
  ) : null;
}

export default IngestionListTable;
