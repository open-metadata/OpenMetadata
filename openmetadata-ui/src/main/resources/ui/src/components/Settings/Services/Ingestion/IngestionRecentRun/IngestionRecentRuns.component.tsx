/*
 *  Copyright 2022 Collate.
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

import { Button, Popover, Skeleton, Space, Tag } from 'antd';
import Modal from 'antd/lib/modal/Modal';
import { ColumnType } from 'antd/lib/table';
import { ExpandableConfig } from 'antd/lib/table/interface';
import classNamesFunc from 'classnames';
import { isEmpty, startCase } from 'lodash';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA } from '../../../../../constants/constants';
import { PIPELINE_INGESTION_RUN_STATUS } from '../../../../../constants/pipeline.constants';
import {
  IngestionPipeline,
  PipelineStatus,
  StepSummary,
} from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getRunHistoryForPipeline } from '../../../../../rest/ingestionPipelineAPI';
import {
  formatDateTime,
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../../utils/date-time/DateTimeUtils';
import Table from '../../../../common/Table/Table';
import ConnectionStepCard from '../../../../common/TestConnection/ConnectionStepCard/ConnectionStepCard';
import './ingestion-recent-run.style.less';

interface Props {
  ingestion?: IngestionPipeline;
  classNames?: string;
  appRuns?: PipelineStatus[];
  isApplicationType?: boolean;
}
const queryParams = {
  startTs: getEpochMillisForPastDays(1),
  endTs: getCurrentMillis(),
};

export const IngestionRecentRuns: FunctionComponent<Props> = ({
  ingestion,
  classNames,
  appRuns,
  isApplicationType,
}: Props) => {
  const { t } = useTranslation();
  const [recentRunStatus, setRecentRunStatus] = useState<PipelineStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<PipelineStatus>();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const columns: ColumnType<StepSummary>[] = useMemo(
    () => [
      {
        title: t('label.step'),
        dataIndex: 'name',
      },
      {
        title: t('label.record-plural'),
        dataIndex: 'records',
      },
      {
        title: t('label.filtered'),
        dataIndex: 'filtered',
      },
      {
        title: t('label.warning-plural'),
        dataIndex: 'warnings',
      },
      {
        title: t('label.error-plural'),
        dataIndex: 'errors',
      },

      {
        title: t('label.failure-plural'),
        dataIndex: 'failures',
        render: (failures: StepSummary['failures'], record: StepSummary) =>
          (failures?.length ?? 0) > 0 ? (
            <Button
              size="small"
              type="link"
              onClick={() => setExpandedKeys([record.name])}>
              {t('label.log-plural')}
            </Button>
          ) : (
            NO_DATA
          ),
      },
    ],
    [setExpandedKeys]
  );
  const expandable: ExpandableConfig<StepSummary> = useMemo(
    () => ({
      expandedRowRender: (record) => {
        return (
          record.failures?.map((failure) => (
            <ConnectionStepCard
              isTestingConnection={false}
              key={failure.name}
              testConnectionStep={{
                name: failure.name,
                mandatory: false,
                description: failure.error,
              }}
              testConnectionStepResult={{
                name: failure.name,
                passed: false,
                mandatory: false,
                message: failure.error,
                errorLog: failure.stackTrace,
              }}
            />
          )) ?? []
        );
      },
      indentSize: 0,
      expandIcon: () => null,
      expandedRowKeys: expandedKeys,
      rowExpandable: (record) => (record.failures?.length ?? 0) > 0,
    }),
    [expandedKeys]
  );

  const fetchPipelineStatus = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getRunHistoryForPipeline(
        ingestion?.fullyQualifiedName ?? '',
        queryParams
      );

      const runs = response.data.splice(0, 5).reverse() ?? [];

      setRecentRunStatus(
        runs.length === 0 && ingestion?.pipelineStatuses
          ? [ingestion.pipelineStatuses]
          : runs
      );
    } finally {
      setLoading(false);
    }
  }, [ingestion, ingestion?.fullyQualifiedName]);

  useEffect(() => {
    if (isApplicationType && appRuns) {
      setRecentRunStatus(appRuns.splice(0, 5).reverse() ?? []);
      setLoading(false);
    } else if (ingestion?.fullyQualifiedName) {
      fetchPipelineStatus();
    }
  }, [ingestion, ingestion?.fullyQualifiedName]);

  const handleRunStatusClick = (status: PipelineStatus) => {
    setExpandedKeys([]);
    setSelectedStatus(status);
  };

  if (loading) {
    return <Skeleton.Input size="small" />;
  }

  return (
    <Space className={classNames} size={2}>
      {isEmpty(recentRunStatus) ? (
        <p data-testid="pipeline-status">--</p>
      ) : (
        recentRunStatus.map((r, i) => {
          const status = (
            <Tag
              className={classNamesFunc('ingestion-run-badge', {
                latest: i === recentRunStatus.length - 1,
              })}
              color={
                PIPELINE_INGESTION_RUN_STATUS[r?.pipelineState ?? 'success']
              }
              data-testid="pipeline-status"
              key={`${r.runId}-status`}
              onClick={() => handleRunStatusClick(r)}>
              {i === recentRunStatus.length - 1
                ? startCase(r?.pipelineState)
                : ''}
            </Tag>
          );

          const showTooltip = r?.endDate ?? r?.startDate ?? r?.timestamp;

          return showTooltip ? (
            <Popover
              content={
                <div className="text-left">
                  {r.timestamp && (
                    <p>
                      {`${t('label.execution-date')}:`}{' '}
                      {formatDateTime(r.timestamp)}
                    </p>
                  )}
                  {r.startDate && (
                    <p>
                      {t('label.start-entity', { entity: t('label.date') })}:{' '}
                      {formatDateTime(r.startDate)}
                    </p>
                  )}
                  {r.endDate && (
                    <p>
                      {`${t('label.end-date')}:`} {formatDateTime(r.endDate)}
                    </p>
                  )}
                </div>
              }
              key={`${r.runId}-timestamp`}>
              {status}
            </Popover>
          ) : (
            status
          );
        }) ?? '--'
      )}

      <Modal
        centered
        destroyOnClose
        closeIcon={<></>}
        maskClosable={false}
        okButtonProps={{ style: { display: 'none' } }}
        open={Boolean(selectedStatus)}
        title={`Run status: ${startCase(
          selectedStatus?.pipelineState
        )} at ${formatDateTime(selectedStatus?.timestamp)}`}
        width="80%"
        onCancel={() => setSelectedStatus(undefined)}>
        <Table
          bordered
          columns={columns}
          dataSource={selectedStatus?.status ?? []}
          expandable={expandable}
          indentSize={0}
          pagination={false}
          rowKey="name"
          size="small"
        />
      </Modal>
    </Space>
  );
};
