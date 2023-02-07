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
import { AxiosError } from 'axios';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import PageHeader from 'components/header/PageHeader.component';
import { useWebSocketConnector } from 'components/web-scoket/web-scoket.provider';
import { isEmpty, startCase } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAllReIndexStatus,
  reIndexByPublisher,
} from 'rest/elasticSearchReIndexAPI';
import { SOCKET_EVENTS } from '../../constants/constants';
import { CreateEventPublisherJob } from '../../generated/api/createEventPublisherJob';
import {
  EventPublisherJob,
  RunMode,
} from '../../generated/settings/eventPublisherJob';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import {
  getEventPublisherStatusText,
  getStatusResultBadgeIcon,
} from '../../utils/EventPublisherUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getDateTimeByTimeStampWithZone } from '../../utils/TimeUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './ElasticSearchReIndex.style.less';
import ReIndexAllModal from './ElasticSearchReIndexModal.component';

const ElasticSearchIndexPage = () => {
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
      const response = await getAllReIndexStatus(RunMode.Batch);

      setBatchJobData(response);
    } catch {
      showErrorToast(jsonData['api-error-messages']['fetch-re-index-all']);
    } finally {
      setBatchLoading(false);
    }
  };

  const fetchStreamReIndexedData = async () => {
    try {
      setStreamLoading(true);
      const response = await getAllReIndexStatus(RunMode.Stream);

      setStreamJobData(response);
    } catch {
      showErrorToast(jsonData['api-error-messages']['fetch-re-index-all']);
    } finally {
      setStreamLoading(false);
    }
  };

  const performReIndexAll = async (data: CreateEventPublisherJob) => {
    try {
      setConfirmLoading(true);
      await reIndexByPublisher({
        ...data,
        runMode: RunMode.Batch,
      } as CreateEventPublisherJob);

      showSuccessToast(jsonData['api-success-messages']['fetch-re-index-all']);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        jsonData['api-error-messages']['update-re-index-all']
      );
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
    <Row align="middle" gutter={[16, 16]}>
      <Col span={24}>
        <PageHeader
          data={{
            header: t('label.elastic-search'),
            subHeader: t('message.elastic-search-message'),
          }}
        />
      </Col>
      <Col span={24}>
        <div>
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
                      title="Refresh log"
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
                title="ElasticSearch">
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
                        <span className="m-l-xs">
                          <Space size={8}>
                            {batchJobData?.status && (
                              <SVGIcons
                                alt="result"
                                className="w-4"
                                icon={getStatusResultBadgeIcon(
                                  batchJobData?.status
                                )}
                              />
                            )}
                            <span>
                              {getEventPublisherStatusText(
                                batchJobData?.status
                              ) || '--'}
                            </span>
                          </Space>
                        </span>
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
                                count={batchJobData?.stats?.total}
                                overflowCount={99999999}
                                title={`Total index sent: ${batchJobData?.stats?.total}`}
                              />

                              <Badge
                                className="request-badge success"
                                count={batchJobData?.stats?.success}
                                overflowCount={99999999}
                                title={`Success index: ${batchJobData?.stats?.success}`}
                              />

                              <Badge
                                showZero
                                className="request-badge failed"
                                count={batchJobData?.stats?.failed}
                                overflowCount={99999999}
                                title={`Failed index: ${batchJobData?.stats?.failed}`}
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
                          {batchJobData?.failureDetails?.lastFailedAt
                            ? getDateTimeByTimeStampWithZone(
                                batchJobData?.failureDetails?.lastFailedAt
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
                      {batchJobData?.failureDetails?.context ? (
                        <RichTextEditorPreviewer
                          enableSeeMoreVariant={Boolean(batchJobData)}
                          markdown={batchJobData?.failureDetails?.context}
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
                      {batchJobData?.failureDetails?.lastFailedReason ? (
                        <RichTextEditorPreviewer
                          enableSeeMoreVariant={Boolean(batchJobData)}
                          markdown={
                            batchJobData?.failureDetails?.lastFailedReason
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
                    title="Refresh log"
                    onClick={fetchStreamReIndexedData}
                  />
                }
                loading={streamLoading}
                size="small"
                title="ElasticSearch">
                <Row gutter={[16, 8]}>
                  <Col span={24}>
                    <Space direction="horizontal" size={16}>
                      <div className="flex">
                        <span className="text-grey-muted">{`${t(
                          'label.mode'
                        )}:`}</span>
                        <span className="m-l-xs">
                          {startCase(streamJobData?.runMode) || '--'}
                        </span>
                      </div>
                      <div className="flex">
                        <span className="text-grey-muted">{`${t(
                          'label.status'
                        )}:`}</span>
                        <span className="m-l-xs">
                          <Space size={8}>
                            {streamJobData?.status && (
                              <SVGIcons
                                alt="result"
                                className="w-4"
                                icon={getStatusResultBadgeIcon(
                                  streamJobData?.status
                                )}
                              />
                            )}
                            <span>
                              {getEventPublisherStatusText(
                                streamJobData?.status
                              ) || '--'}
                            </span>
                          </Space>
                        </span>
                      </div>

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
                      <div className="flex">
                        <span className="text-grey-muted">{`${t(
                          'label.last-failed-at'
                        )}:`}</span>
                        <p className="m-l-xs">
                          {streamJobData?.failureDetails?.lastFailedAt
                            ? getDateTimeByTimeStampWithZone(
                                streamJobData?.failureDetails?.lastFailedAt
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
                      {streamJobData?.failureDetails?.context ? (
                        <RichTextEditorPreviewer
                          enableSeeMoreVariant={Boolean(streamJobData)}
                          markdown={streamJobData?.failureDetails?.context}
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
                      {streamJobData?.failureDetails?.lastFailedReason ? (
                        <RichTextEditorPreviewer
                          enableSeeMoreVariant={Boolean(streamJobData)}
                          markdown={
                            streamJobData?.failureDetails?.lastFailedReason
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
        </div>
      </Col>
    </Row>
  );
};

export default ElasticSearchIndexPage;
