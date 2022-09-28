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

import { ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import {
  getAllReIndexStatus,
  reIndexByPublisher,
} from '../../axiosAPIs/elastic-index-API';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../components/PermissionProvider/PermissionProvider.interface';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { Operation } from '../../generated/api/policies/createPolicy';
import { EventPublisherJob } from '../../generated/settings/eventPublisherJob';
import jsonData from '../../jsons/en';
import { checkPermission } from '../../utils/PermissionsUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getStatusResultBadgeIcon } from '../../utils/TableUtils';
import { getDateTimeByTimeStampWithZone } from '../../utils/TimeUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const ElasticSearchIndexPage = () => {
  const [elasticSearchReIndexData, setElasticSearchReIndexData] =
    useState<EventPublisherJob>();

  const [isLoading, setIsLoading] = useState(false);

  const { permissions } = usePermissionProvider();

  const createPermission = useMemo(
    () => checkPermission(Operation.All, ResourceEntity.USER, permissions),
    [permissions]
  );

  const fetchAllReIndexedData = async () => {
    try {
      setIsLoading(true);
      const response = await getAllReIndexStatus();

      setElasticSearchReIndexData(response[0]);
    } catch {
      showErrorToast(jsonData['api-error-messages']['fetch-re-index-all']);
    } finally {
      setIsLoading(false);
    }
  };

  const performReIndexAll = async () => {
    try {
      await reIndexByPublisher();

      showSuccessToast(jsonData['api-success-messages']['fetch-re-index-all']);
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        jsonData['api-error-messages']['update-re-index-all']
      );
    }
  };

  const handleRefreshIndex = () => fetchAllReIndexedData();

  useEffect(() => {
    fetchAllReIndexedData();
  }, []);

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Space className="w-full justify-end">
            <Space align="center" size={16}>
              <Button
                data-testid="elastic-search-re-fetch-data"
                disabled={!createPermission || isLoading}
                icon={<ReloadOutlined />}
                onClick={handleRefreshIndex}
              />
            </Space>

            <Space align="center" size={16}>
              <Tooltip
                title={
                  createPermission
                    ? 'Elastic search re-index all'
                    : NO_PERMISSION_FOR_ACTION
                }>
                <Button
                  data-testid="elastic-search-re-index-all"
                  disabled={!createPermission}
                  type="primary"
                  onClick={performReIndexAll}>
                  Re Index All
                </Button>
              </Tooltip>
            </Space>
          </Space>
        </Col>
        <Col span={24}>
          <Row>
            <Col span={24}>
              <Card size="small">
                <Typography.Title level={5}>ElasticSearch</Typography.Title>
                <Space direction="horizontal" size={16}>
                  <div className="tw-flex">
                    <span className="tw-text-grey-muted">Mode</span> :
                    <span className="tw-ml-2">
                      {elasticSearchReIndexData?.runMode || '--'}
                    </span>
                  </div>
                  <div className="tw-flex">
                    <span className="tw-text-grey-muted">Status</span> :
                    <span className="tw-ml-2">
                      <Space size={8}>
                        {elasticSearchReIndexData?.status && (
                          <SVGIcons
                            alt="result"
                            className="w-4"
                            icon={getStatusResultBadgeIcon(
                              elasticSearchReIndexData?.status
                            )}
                          />
                        )}
                        <span>{elasticSearchReIndexData?.status || '--'}</span>
                      </Space>
                    </span>
                  </div>

                  <div className="tw-flex">
                    <span className="tw-text-grey-muted">Last Updated</span> :
                    <span className="tw-ml-2">
                      {elasticSearchReIndexData?.failureDetails?.lastFailedAt
                        ? getDateTimeByTimeStampWithZone(
                            elasticSearchReIndexData?.failureDetails
                              ?.lastFailedAt
                          )
                        : '--'}
                    </span>
                  </div>
                </Space>
                <div className="m-t-sm">
                  <span className="tw-text-grey-muted">Last error</span> :
                  <span className="tw-ml-2">
                    {elasticSearchReIndexData?.failureDetails
                      ?.lastFailedReason ? (
                      <RichTextEditorPreviewer
                        enableSeeMoreVariant={Boolean(elasticSearchReIndexData)}
                        markdown={
                          elasticSearchReIndexData?.failureDetails
                            ?.lastFailedReason
                        }
                      />
                    ) : (
                      '--'
                    )}
                  </span>
                </div>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default ElasticSearchIndexPage;
