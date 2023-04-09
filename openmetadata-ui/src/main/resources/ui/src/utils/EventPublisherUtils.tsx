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

import { ReloadOutlined } from '@ant-design/icons';
import { Badge, Button, Card, Col, Divider, Row, Space } from 'antd';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Loader from 'components/Loader/Loader';
import {
  EventPublisherJob,
  SourceError,
  Status,
} from 'generated/system/eventPublisherJob';
import { t } from 'i18next';
import { isEmpty, startCase } from 'lodash';
import React from 'react';
import { ReactComponent as IconFailBadge } from '../assets/svg/fail-badge.svg';
import { ReactComponent as IconTaskOpen } from '../assets/svg/in-progress.svg';
import { ReactComponent as IconSuccessBadge } from '../assets/svg/success-badge.svg';
import { getDateTimeByTimeStampWithZone } from './TimeUtils';

export const getStatusResultBadgeIcon = (status?: string) => {
  switch (status) {
    case Status.Completed:
      return <IconSuccessBadge height={14} width={14} />;

    case Status.Failed:
    case Status.ActiveWithError:
      return <IconFailBadge height={14} width={14} />;

    case Status.Running:
    case Status.Started:
      return <Loader size="x-small" />;

    case Status.Active:
    default:
      return <IconTaskOpen height={14} width={14} />;
  }
};

export const getEventPublisherStatusText = (status?: string) => {
  switch (status) {
    case Status.Failed:
      return t('label.failed');
    case Status.Running:
      return t('label.running');
    case Status.Completed:
      return t('label.completed');
    case Status.Active:
      return t('label.active');

    case Status.ActiveWithError:
      return t('label.active-with-error');

    case Status.Started:
      return t('label.started');

    default:
      return status || '';
  }
};

export const getJobDetailsCard = (
  loadingState: boolean,
  fetchJobData: () => Promise<void>,
  jobData?: EventPublisherJob,
  error?: SourceError,
  handleModalVisibility?: (state: boolean) => void
) => {
  return (
    <Card
      extra={
        <Space>
          <Button
            data-testid="elastic-search-re-fetch-data"
            disabled={loadingState}
            icon={<ReloadOutlined />}
            size="small"
            title={t('label.refresh-log')}
            onClick={fetchJobData}
          />
          {handleModalVisibility && (
            <Button
              data-testid="elastic-search-re-index-all"
              size="small"
              type="primary"
              onClick={() => handleModalVisibility(true)}>
              {t('label.re-index-all')}
            </Button>
          )}
        </Space>
      }
      loading={loadingState}
      size="small"
      title={t('label.elasticsearch')}>
      <Row gutter={[16, 8]}>
        <Col span={24}>
          <Space wrap direction="horizontal" size={0}>
            <div className="flex">
              <span className="text-grey-muted">{`${t('label.mode')}:`}</span>
              <span className="m-l-xs">
                {startCase(jobData?.runMode) || '--'}
              </span>
            </div>
            <Divider type="vertical" />
            <div className="flex">
              <span className="text-grey-muted">{`${t('label.status')}:`}</span>

              <Space align="center" className="m-l-xs" size={8}>
                {getStatusResultBadgeIcon(jobData?.status)}
                <span>
                  {getEventPublisherStatusText(jobData?.status) || '--'}
                </span>
              </Space>
            </div>
            <Divider type="vertical" />
            {handleModalVisibility && (
              <div className="flex">
                <span className="text-grey-muted">{`${t(
                  'label.index-states'
                )}:`}</span>
                <span className="m-l-xs">
                  {!isEmpty(jobData) ? (
                    <Space size={8}>
                      <Badge
                        className="request-badge running"
                        count={jobData?.stats?.jobStats?.totalRecords}
                        overflowCount={99999999}
                        title={`${t('label.total-index-sent')}: ${
                          jobData?.stats?.jobStats?.totalRecords
                        }`}
                      />

                      <Badge
                        className="request-badge success"
                        count={jobData?.stats?.jobStats?.successRecords}
                        overflowCount={99999999}
                        title={`${t('label.entity-index', {
                          entity: t('label.success'),
                        })}: ${jobData?.stats?.jobStats?.successRecords}`}
                      />

                      <Badge
                        showZero
                        className="request-badge failed"
                        count={jobData?.stats?.jobStats?.failedRecords}
                        overflowCount={99999999}
                        title={`${t('label.entity-index', {
                          entity: t('label.failed'),
                        })}: ${jobData?.stats?.jobStats?.failedRecords}`}
                      />
                    </Space>
                  ) : (
                    '--'
                  )}
                </span>
              </div>
            )}
            <Divider type="vertical" />
            <div className="flex">
              <span className="text-grey-muted">{`${t(
                'label.last-updated'
              )}:`}</span>
              <span className="m-l-xs">
                {jobData?.timestamp
                  ? getDateTimeByTimeStampWithZone(jobData?.timestamp)
                  : '--'}
              </span>
            </div>
            <Divider type="vertical" />
            <div className="flex">
              <span className="text-grey-muted">{`${t(
                'label.last-failed-at'
              )}:`}</span>
              <p className="m-l-xs">
                {error
                  ? getDateTimeByTimeStampWithZone(error?.lastFailedAt ?? 0)
                  : '--'}
              </p>
            </div>
          </Space>
        </Col>
        <Col span={24}>
          <span className="text-grey-muted">{`${t(
            'label.failure-context'
          )}:`}</span>
          <span className="m-l-xs">
            {error?.context ? (
              <RichTextEditorPreviewer
                enableSeeMoreVariant={Boolean(jobData)}
                markdown={error?.context}
              />
            ) : (
              '--'
            )}
          </span>
        </Col>
        <Col span={24}>
          <span className="text-grey-muted">{`${t('label.last-error')}:`}</span>
          <span className="m-l-xs">
            {error?.lastFailedReason ? (
              <RichTextEditorPreviewer
                enableSeeMoreVariant={Boolean(jobData)}
                markdown={error?.lastFailedReason}
              />
            ) : (
              '--'
            )}
          </span>
        </Col>
      </Row>
    </Card>
  );
};
