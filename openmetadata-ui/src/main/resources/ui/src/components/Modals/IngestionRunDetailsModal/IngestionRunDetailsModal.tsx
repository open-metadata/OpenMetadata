/*
 *  Copyright 2024 Collate.
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

import { Button, Col, Modal, Row, Typography } from 'antd';
import { ColumnType } from 'antd/lib/table';
import { ExpandableConfig } from 'antd/lib/table/interface';
import { isArray, startCase } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA } from '../../../constants/constants';
import { AppRunRecord } from '../../../generated/entity/applications/appRunRecord';
import {
  PipelineStatus,
  StepSummary,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import Table from '../../common/Table/Table';
import ConnectionStepCard from '../../common/TestConnection/ConnectionStepCard/ConnectionStepCard';
import { IngestionRunDetailsModalProps } from './IngestionRunDetailsModal.interface';

function IngestionRunDetailsModal<T extends PipelineStatus | AppRunRecord>({
  pipelineStatus,
  handleCancel,
}: Readonly<IngestionRunDetailsModalProps<T>>) {
  const { t } = useTranslation();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const columns: ColumnType<StepSummary>[] = useMemo(
    () => [
      {
        title: t('label.step'),
        dataIndex: 'name',
        render: (_, record: StepSummary) => (
          <Typography.Text data-testid={`step-summary-name-${record.name}`}>
            {getEntityName(record)}
          </Typography.Text>
        ),
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
        title: t('label.updated'),
        dataIndex: 'updated_records',
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
              data-testid={`log-${record.name}`}
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
        return record.failures ? (
          <Row gutter={[16, 16]}>
            {record.failures.map((failure) => (
              <Col key={failure.name} span={24}>
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
              </Col>
            ))}
          </Row>
        ) : undefined;
      },
      indentSize: 0,
      expandIcon: () => null,
      expandedRowKeys: expandedKeys,
      rowExpandable: (record) => (record.failures?.length ?? 0) > 0,
    }),
    [expandedKeys]
  );

  return (
    <Modal
      centered
      destroyOnClose
      open
      closable={false}
      maskClosable={false}
      okButtonProps={{ style: { display: 'none' } }}
      title={t('message.run-status-at-timestamp', {
        status: startCase(
          (pipelineStatus as PipelineStatus)?.pipelineState ??
            (pipelineStatus as AppRunRecord)?.status
        ),
        timestamp: formatDateTime(pipelineStatus?.timestamp),
      })}
      width="80%"
      onCancel={handleCancel}>
      <Table
        columns={columns}
        dataSource={
          isArray(pipelineStatus?.status) ? pipelineStatus?.status : []
        }
        expandable={expandable}
        indentSize={0}
        pagination={false}
        rowKey="name"
        size="small"
      />
    </Modal>
  );
}

export default IngestionRunDetailsModal;
