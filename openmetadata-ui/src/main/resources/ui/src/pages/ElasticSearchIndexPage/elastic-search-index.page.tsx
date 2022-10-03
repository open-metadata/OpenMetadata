/*
 *  Copyright 2022 Collate
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

import { QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Row,
  Skeleton,
  Space,
  Switch,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, startCase } from 'lodash';
import React, { useEffect, useState } from 'react';
import {
  getAllReIndexStatus,
  reIndexByPublisher,
} from '../../axiosAPIs/elastic-index-API';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import { ELASTIC_SEARCH_INDEX_ENTITIES } from '../../constants/elasticsearch.constant';
import {
  EventPublisherJob,
  PublisherType,
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
import './elastic-search-index.style.less';

const ElasticSearchIndexPage = () => {
  const [batchJobData, setBatchJobData] = useState<EventPublisherJob>();
  const [streamJobData, setStreamJobData] = useState<EventPublisherJob>();

  const { isAdminUser } = useAuth();
  const [batchLoading, setBatchLoading] = useState(false);
  const [streamLoading, setStreamLoading] = useState(false);
  const [recreateIndex, setRecreateIndex] = useState(false);
  const [entities, setEntities] = useState<string[]>([
    'table',
    'topic',
    'dashboard',
    'pipeline',
    'mlmodel',
    'bot',
    'user',
    'team',
    'glossaryTerm',
    'tag',
  ]);

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

  const performReIndexAll = async (mode: RunMode) => {
    try {
      await reIndexByPublisher({
        runMode: mode,
        entities,
        recreateIndex,
        publisherType: PublisherType.ElasticSearch,
      });

      showSuccessToast(jsonData['api-success-messages']['fetch-re-index-all']);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        jsonData['api-error-messages']['update-re-index-all']
      );
    }
  };

  const fetchData = () => {
    fetchBatchReIndexedData();
    fetchStreamReIndexedData();
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card size="small">
                <div className="d-flex justify-between">
                  <div>
                    <Skeleton loading={batchLoading}>
                      <Typography.Title level={5}>
                        ElasticSearch
                      </Typography.Title>
                      <Space direction="horizontal" size={16}>
                        <div className="tw-flex">
                          <span className="tw-text-grey-muted">Mode</span> :
                          <span className="tw-ml-2">
                            {startCase(batchJobData?.runMode) || '--'}
                          </span>
                        </div>
                        <div className="tw-flex">
                          <span className="tw-text-grey-muted">Status</span> :
                          <span className="tw-ml-2">
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

                        <div className="tw-flex">
                          <span className="tw-text-grey-muted">
                            Index stats
                          </span>{' '}
                          :
                          <span className="tw-ml-2">
                            {!isEmpty(batchJobData) ? (
                              <Space size={8}>
                                <Badge
                                  className="request-badge running"
                                  count={batchJobData?.stats?.total}
                                  title={`Total index sent: ${batchJobData?.stats?.total}`}
                                />

                                <Badge
                                  className="request-badge success"
                                  count={batchJobData?.stats?.success}
                                  title={`Success index: ${batchJobData?.stats?.success}`}
                                />

                                <Badge
                                  showZero
                                  className="request-badge failed"
                                  count={batchJobData?.stats?.failed}
                                  title={`Failed index: ${batchJobData?.stats?.failed}`}
                                />
                              </Space>
                            ) : (
                              '--'
                            )}
                          </span>
                        </div>

                        <div className="tw-flex">
                          <span className="tw-text-grey-muted">
                            Last Updated
                          </span>{' '}
                          :
                          <span className="tw-ml-2">
                            {batchJobData?.timestamp
                              ? getDateTimeByTimeStampWithZone(
                                  batchJobData?.timestamp
                                )
                              : '--'}
                          </span>
                        </div>
                      </Space>
                      <Space className="m-t-sm" size={16}>
                        <div>
                          <span className="tw-text-grey-muted">
                            Last Failed At:
                          </span>
                          <p className="tw-ml-2">
                            {batchJobData?.failureDetails?.lastFailedAt
                              ? getDateTimeByTimeStampWithZone(
                                  batchJobData?.failureDetails?.lastFailedAt
                                )
                              : '--'}
                          </p>
                        </div>
                        <div>
                          <span className="tw-text-grey-muted">
                            Last error:
                          </span>
                          <span className="tw-ml-2">
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
                        </div>
                      </Space>
                    </Skeleton>
                  </div>

                  <Space
                    direction="vertical"
                    size={16}
                    style={{ maxWidth: '420px' }}>
                    <Space size={8}>
                      <Switch
                        checked={recreateIndex}
                        onChange={setRecreateIndex}
                      />
                      <Typography.Text
                        className="d-flex items-center"
                        type="secondary">
                        Recreate indexes&nbsp;
                        <Tooltip
                          placement="bottomRight"
                          title="This will delete exiting indexing and create new">
                          <QuestionCircleOutlined />
                        </Tooltip>
                      </Typography.Text>
                    </Space>
                    <div>
                      <Typography.Text className="m-b-sm">
                        Entities
                      </Typography.Text>
                      <Checkbox.Group
                        defaultValue={entities}
                        onChange={(values) => setEntities(values as string[])}>
                        <Row>
                          {ELASTIC_SEARCH_INDEX_ENTITIES.map((option) => (
                            <Col key={option.value} span={8}>
                              <Checkbox value={option.value}>
                                {option.label}
                              </Checkbox>
                            </Col>
                          ))}
                        </Row>
                      </Checkbox.Group>
                    </div>

                    <Space align="center" className="flex-end" size={16}>
                      <Button
                        data-testid="elastic-search-re-fetch-data"
                        disabled={batchLoading}
                        icon={<ReloadOutlined />}
                        onClick={fetchBatchReIndexedData}
                      />
                      <Button
                        data-testid="elastic-search-re-index-all"
                        disabled={!isAdminUser}
                        type="primary"
                        onClick={() => performReIndexAll(RunMode.Batch)}>
                        Re Index All
                      </Button>
                    </Space>
                  </Space>
                </div>
              </Card>
            </Col>
            <Col span={24}>
              <Card size="small">
                <div className="d-flex justify-between">
                  <Typography.Title level={5}>ElasticSearch</Typography.Title>
                  <Space align="center" size={16}>
                    <Button
                      data-testid="elastic-search-re-fetch-data"
                      disabled={streamLoading}
                      icon={<ReloadOutlined />}
                      onClick={fetchStreamReIndexedData}
                    />
                  </Space>
                </div>
                <Skeleton loading={streamLoading}>
                  <Space direction="horizontal" size={16}>
                    <div className="tw-flex">
                      <span className="tw-text-grey-muted">Mode</span> :
                      <span className="tw-ml-2">
                        {startCase(streamJobData?.runMode) || '--'}
                      </span>
                    </div>
                    <div className="tw-flex">
                      <span className="tw-text-grey-muted">Status</span> :
                      <span className="tw-ml-2">
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

                    <div className="tw-flex">
                      <span className="tw-text-grey-muted">Last Updated</span> :
                      <span className="tw-ml-2">
                        {streamJobData?.timestamp
                          ? getDateTimeByTimeStampWithZone(
                              streamJobData?.timestamp
                            )
                          : '--'}
                      </span>
                    </div>
                  </Space>
                  <div>
                    <Space className="m-t-sm" size={16}>
                      <div>
                        <span className="tw-text-grey-muted">
                          Last Failed At:
                        </span>
                        <p className="tw-ml-2">
                          {streamJobData?.failureDetails?.lastFailedAt
                            ? getDateTimeByTimeStampWithZone(
                                streamJobData?.failureDetails?.lastFailedAt
                              )
                            : '--'}
                        </p>
                      </div>
                      <div>
                        <span className="tw-text-grey-muted">Last error</span> :
                        <span className="tw-ml-2">
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
                      </div>
                    </Space>
                  </div>
                </Skeleton>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default ElasticSearchIndexPage;
