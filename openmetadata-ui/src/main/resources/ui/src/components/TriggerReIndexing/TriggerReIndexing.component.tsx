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

import { ReloadOutlined } from '@ant-design/icons';
import { Badge, Button, Card, Col, Divider, Row, Space } from 'antd';
import { AxiosError } from 'axios';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { useWebSocketConnector } from 'components/web-scoket/web-scoket.provider';
import {
  ELASTIC_SEARCH_INDEX_ENTITIES,
  ELASTIC_SEARCH_INITIAL_VALUES,
} from 'constants/elasticsearch.constant';
import { isEmpty, isEqual, startCase } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getBatchJobReIndexStatus,
  getStreamJobReIndexStatus,
  reIndexByPublisher,
} from 'rest/elasticSearchReIndexAPI';
import { SOCKET_EVENTS } from '../../constants/constants';
import { CreateEventPublisherJob } from '../../generated/api/createEventPublisherJob';
import {
  EventPublisherJob,
  RunMode,
} from '../../generated/system/eventPublisherJob';
import { useAuth } from '../../hooks/authHooks';
import {
  getEventPublisherStatusText,
  getStatusResultBadgeIcon,
} from '../../utils/EventPublisherUtils';
import { getDateTimeByTimeStampWithZone } from '../../utils/TimeUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ReIndexAllModal from './ElasticSearchReIndexModal.component';

function TriggerReIndexing() {
  const { t } = useTranslation();
  const [batchJobData, setBatchJobData] = useState<EventPublisherJob>();
  const [streamJobData, setStreamJobData] = useState<EventPublisherJob>();

  const { isAdminUser } = useAuth();
  const [batchLoading, setBatchLoading] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [isModalOpen, setModalOpen] = useState(false);

  const { socket } = useWebSocketConnector();

  const fetchBatchReIndexedData = async () => {
    try {
      setBatchLoading(true);
      const response = await getBatchJobReIndexStatus();

      setBatchJobData(response);
    } catch {
      showErrorToast(t('server.fetch-re-index-data-error'));
    } finally {
      setBatchLoading(false);
    }
  };

  const fetchStreamReIndexedData = async () => {
    try {
      setStreamLoading(true);
      const response = await getStreamJobReIndexStatus();

      setStreamJobData(response);
    } catch {
      showErrorToast(t('server.fetch-re-index-data-error'));
    } finally {
      setStreamLoading(false);
    }
  };

  const performReIndexAll = async (data: CreateEventPublisherJob) => {
    try {
      setConfirmLoading(true);
      await reIndexByPublisher({
        ...data,
        entities: isEqual(data.entities, ELASTIC_SEARCH_INITIAL_VALUES.entities)
          ? ELASTIC_SEARCH_INDEX_ENTITIES.map((e) => e.value)
          : data.entities ?? [],
        runMode: RunMode.Batch,
      } as CreateEventPublisherJob);

      showSuccessToast(t('server.re-indexing-started'));
    } catch (err) {
      showErrorToast(err as AxiosError, t('server.re-indexing-error'));
    } finally {
      setModalOpen(false);
      setConfirmLoading(false);
    }
  };

  const fetchData = () => {
    fetchBatchReIndexedData();
    fetchStreamReIndexedData();
  };

  useEffect(() => {
    if (socket) {
      socket.on(SOCKET_EVENTS.JOB_STATUS, (newActivity) => {
        if (newActivity) {
          const activity = JSON.parse(newActivity) as EventPublisherJob;
          if (activity.runMode === RunMode.Batch) {
            setBatchJobData(activity);
          } else {
            setStreamJobData(activity);
          }
        }
      });
    }

    return () => {
      socket && socket.off(SOCKET_EVENTS.JOB_STATUS);
    };
  }, [socket]);

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            extra={
              <Space>
                <Button
                  data-testid="elastic-search-re-fetch-data"
                  disabled={batchLoading}
                  icon={<ReloadOutlined />}
                  size="small"
                  title={t('label.refresh-log')}
                  onClick={fetchBatchReIndexedData}
                />
                <Button
                  data-testid="elastic-search-re-index-all"
                  disabled={!isAdminUser}
                  size="small"
                  type="primary"
                  onClick={() => setModalOpen(true)}>
                  {t('label.re-index-all')}
                </Button>
              </Space>
            }
            loading={batchLoading}
            size="small"
            title={t('label.elasticsearch')}>
            <Row gutter={[16, 8]}>
              <Col span={24}>
                <Space wrap direction="horizontal" size={0}>
                  <div className="flex">
                    <span className="text-grey-muted">{`${t(
                      'label.mode'
                    )}:`}</span>
                    <span className="m-l-xs">
                      {startCase(batchJobData?.runMode) || '--'}
                    </span>
                  </div>
                  <Divider type="vertical" />
                  <div className="flex">
                    <span className="text-grey-muted">{`${t(
                      'label.status'
                    )}:`}</span>

                    <Space align="center" className="m-l-xs" size={8}>
                      {getStatusResultBadgeIcon(batchJobData?.status)}
                      <span>
                        {getEventPublisherStatusText(batchJobData?.status) ||
                          '--'}
                      </span>
                    </Space>
                  </div>
                  <Divider type="vertical" />
                  <div className="flex">
                    <span className="text-grey-muted">{`${t(
                      'label.index-states'
                    )}:`}</span>
                    <span className="m-l-xs">
                      {!isEmpty(batchJobData) ? (
                        <Space size={8}>
                          <Badge
                            className="request-badge running"
                            count={batchJobData?.stats?.jobStats?.totalRecords}
                            overflowCount={99999999}
                            title={`${t('label.total-index-sent')}: ${
                              batchJobData?.stats?.jobStats?.totalRecords
                            }`}
                          />

                          <Badge
                            className="request-badge success"
                            count={
                              batchJobData?.stats?.jobStats?.successRecords
                            }
                            overflowCount={99999999}
                            title={`${t('label.entity-index', {
                              entity: t('label.success'),
                            })}: ${
                              batchJobData?.stats?.jobStats?.successRecords
                            }`}
                          />

                          <Badge
                            showZero
                            className="request-badge failed"
                            count={batchJobData?.stats?.jobStats?.failedRecords}
                            overflowCount={99999999}
                            title={`${t('label.entity-index', {
                              entity: t('label.failed'),
                            })}: ${
                              batchJobData?.stats?.jobStats?.failedRecords
                            }`}
                          />
                        </Space>
                      ) : (
                        '--'
                      )}
                    </span>
                  </div>
                  <Divider type="vertical" />
                  <div className="flex">
                    <span className="text-grey-muted">{`${t(
                      'label.last-updated'
                    )}:`}</span>
                    <span className="m-l-xs">
                      {batchJobData?.timestamp
                        ? getDateTimeByTimeStampWithZone(
                            batchJobData?.timestamp
                          )
                        : '--'}
                    </span>
                  </div>
                  <Divider type="vertical" />
                  <div className="flex">
                    <span className="text-grey-muted">{`${t(
                      'label.last-failed-at'
                    )}:`}</span>
                    <p className="m-l-xs">
                      {batchJobData?.failure?.sourceError
                        ? getDateTimeByTimeStampWithZone(
                            batchJobData?.failure?.sourceError?.lastFailedAt ??
                              0
                          )
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
                  {batchJobData?.failure?.sourceError?.context ? (
                    <RichTextEditorPreviewer
                      enableSeeMoreVariant={Boolean(batchJobData)}
                      markdown={batchJobData?.failure?.sourceError?.context}
                    />
                  ) : (
                    '--'
                  )}
                </span>
              </Col>
              <Col span={24}>
                <span className="text-grey-muted">{`${t(
                  'label.last-error'
                )}:`}</span>
                <span className="m-l-xs">
                  {batchJobData?.failure?.sourceError?.lastFailedReason ? (
                    <RichTextEditorPreviewer
                      enableSeeMoreVariant={Boolean(batchJobData)}
                      markdown={
                        batchJobData?.failure?.sourceError?.lastFailedReason
                      }
                    />
                  ) : (
                    '--'
                  )}
                </span>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={24}>
          <Card
            extra={
              <Button
                data-testid="elastic-search-re-fetch-data"
                disabled={streamLoading}
                icon={<ReloadOutlined />}
                size="small"
                title={t('label.refresh-log')}
                onClick={fetchStreamReIndexedData}
              />
            }
            loading={streamLoading}
            size="small"
            title={t('label.elasticsearch')}>
            <Row gutter={[16, 8]}>
              <Col span={24}>
                <Space direction="horizontal" size={0}>
                  <div className="flex">
                    <span className="text-grey-muted">{`${t(
                      'label.mode'
                    )}:`}</span>
                    <span className="m-l-xs">
                      {startCase(streamJobData?.runMode) || '--'}
                    </span>
                  </div>
                  <Divider type="vertical" />
                  <div className="flex">
                    <span className="text-grey-muted">{`${t(
                      'label.status'
                    )}:`}</span>
                    <Space align="center" className="m-l-xs" size={8}>
                      {getStatusResultBadgeIcon(streamJobData?.status)}
                      <span>
                        {getEventPublisherStatusText(streamJobData?.status) ||
                          '--'}
                      </span>
                    </Space>
                  </div>
                  <Divider type="vertical" />
                  <div className="flex">
                    <span className="text-grey-muted">{`${t(
                      'label.last-updated'
                    )}:`}</span>
                    <span className="m-l-xs">
                      {streamJobData?.timestamp
                        ? getDateTimeByTimeStampWithZone(
                            streamJobData?.timestamp
                          )
                        : '--'}
                    </span>
                  </div>
                  <Divider type="vertical" />
                  <div className="flex">
                    <span className="text-grey-muted">{`${t(
                      'label.last-failed-at'
                    )}:`}</span>
                    <p className="m-l-xs">
                      {streamJobData?.failure?.sinkError?.lastFailedAt
                        ? getDateTimeByTimeStampWithZone(
                            streamJobData?.failure?.sinkError?.lastFailedAt
                          )
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
                  {streamJobData?.failure?.sinkError?.context ? (
                    <RichTextEditorPreviewer
                      enableSeeMoreVariant={Boolean(streamJobData)}
                      markdown={streamJobData?.failure?.sinkError?.context}
                    />
                  ) : (
                    '--'
                  )}
                </span>
              </Col>
              <Col span={24}>
                <span className="text-grey-muted">{`${t(
                  'label.last-error'
                )}:`}</span>
                <span className="m-l-xs">
                  {streamJobData?.failure ? (
                    <RichTextEditorPreviewer
                      enableSeeMoreVariant={Boolean(streamJobData)}
                      markdown={
                        streamJobData?.failure?.sourceError?.lastFailedReason ??
                        ''
                      }
                    />
                  ) : (
                    '--'
                  )}
                </span>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
      <ReIndexAllModal
        confirmLoading={confirmLoading}
        visible={isModalOpen}
        onCancel={() => setModalOpen(false)}
        onSave={performReIndexAll}
      />
    </>
  );
}

export default TriggerReIndexing;
