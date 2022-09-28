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

import { Button, Col, Row, Space, Table, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import { lowerCase } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import {
  getAllReIndexStatus,
  reIndexByPublisher,
} from '../../axiosAPIs/elastic-index-API';
import Searchbar from '../../components/common/searchbar/Searchbar';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../components/PermissionProvider/PermissionProvider.interface';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { Operation } from '../../generated/api/policies/createPolicy';
import { EventPublisherJob } from '../../generated/settings/eventPublisherJob';
import jsonData from '../../jsons/en';
import { checkPermission } from '../../utils/PermissionsUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getStatusResultBadgeIcon } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const ElasticSearchIndexPage = () => {
  const [elasticSearchReIndexData, setElasticSearchReIndexData] = useState<
    EventPublisherJob[]
  >([]);
  const { permissions } = usePermissionProvider();

  const [searchedData, setSearchedData] = useState(elasticSearchReIndexData);

  const createPermission = useMemo(
    () => checkPermission(Operation.All, ResourceEntity.USER, permissions),
    [permissions]
  );

  const fetchAllReIndexedData = async () => {
    try {
      const response = await getAllReIndexStatus();
      setElasticSearchReIndexData([response]);
    } catch {
      showErrorToast(jsonData['api-error-messages']['fetch-re-index-all']);
    }
  };

  const performReIndexAll = async () => {
    try {
      await reIndexByPublisher();
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        jsonData['api-error-messages']['update-re-index-all']
      );
    }
  };

  const handleSearch = (text: string) => {
    if (text) {
      const normalizeText = lowerCase(text);
      const matchedData = elasticSearchReIndexData.filter((filter) =>
        filter?.startedBy?.includes(normalizeText)
      );
      setSearchedData(matchedData);
    } else {
      setSearchedData(elasticSearchReIndexData);
    }
  };

  const handleClickReIndex = () => {
    performReIndexAll();
  };

  const columns = useMemo(
    () => [
      {
        title: 'Name',
        dataIndex: 'startedBy',
        key: 'startedBy',
      },
      {
        title: 'State Time',
        dataIndex: 'startTime',
        key: 'startTime',
      },
      {
        title: 'End Time',
        dataIndex: 'endTime',
        key: 'endTime',
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (result: string) => {
          return (
            <Space size={8}>
              {result && (
                <SVGIcons
                  alt="result"
                  className="tw-w-4"
                  icon={getStatusResultBadgeIcon(result)}
                />
              )}
              <span>{result || '--'}</span>
            </Space>
          );
        },
      },
    ],
    []
  );

  useEffect(() => {
    fetchAllReIndexedData();
  }, []);

  useEffect(() => {
    setSearchedData(elasticSearchReIndexData);
  }, [elasticSearchReIndexData]);

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Searchbar
            removeMargin
            placeholder="Search for elastic search index..."
            typingInterval={500}
            onSearch={handleSearch}
          />
        </Col>
        <Col span={16}>
          <Space align="center" className="tw-w-full tw-justify-end" size={16}>
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
                onClick={handleClickReIndex}>
                Re Index All
              </Button>
            </Tooltip>
          </Space>
        </Col>
        <Col span={24}>
          <Row>
            <Col span={24}>
              <Table
                columns={columns}
                dataSource={searchedData}
                pagination={false}
                size="small"
              />
            </Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default ElasticSearchIndexPage;
