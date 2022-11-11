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
import { Card, Col, Empty, Row, Space, Tooltip, Typography } from 'antd';
import { isEmpty, uniqueId } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PipelineStatus } from '../../../generated/entity/data/pipeline';
import { getTreeViewData } from '../../../utils/executionUtils';
import { getStatusBadgeIcon } from '../../../utils/PipelineDetailsUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { formatDateTimeFromSeconds } from '../../../utils/TimeUtils';
import './tree-view-tab.less';

interface TreeViewProps {
  executions: Array<PipelineStatus> | undefined;
  status: string;
  startTime: number;
  endTime: number;
}

const TreeViewTab = ({
  executions,
  status,
  startTime,
  endTime,
}: TreeViewProps) => {
  const viewData = useMemo(
    () => getTreeViewData(executions as PipelineStatus[], status),
    [executions, status]
  );

  const { t } = useTranslation();

  return (
    <Card>
      <Row align="middle" className="m-b-lg m-t-md" justify="center">
        <SVGIcons
          alt="result"
          className="tw-w-4 transform-180 m-r-7 cursor-pointer"
          icon={Icons.ARROW_RIGHT}
        />
        <Typography.Title className="p-b-0" level={5}>
          {formatDateTimeFromSeconds(startTime)} to{' '}
          {formatDateTimeFromSeconds(endTime)}
        </Typography.Title>

        <SVGIcons
          alt="result"
          className="tw-w-4 m-l-7 cursor-pointer"
          icon={Icons.ARROW_RIGHT}
        />
      </Row>

      {isEmpty(viewData) && (
        <Empty
          className="my-4"
          description={t('label.no-execution-runs-found')}
        />
      )}

      {Object.entries(viewData).map(([key, value]) => {
        return (
          <Row gutter={16} key={uniqueId()}>
            <Col span={5}>
              <Space>
                <div className="tree-view-dot" />
                <Typography.Text type="secondary">{key}</Typography.Text>
              </Space>
            </Col>

            <Col span={19}>
              <div className="execution-node-container">
                {value.map((status) => (
                  <Tooltip
                    key={uniqueId()}
                    placement="top"
                    title={
                      <Space direction="vertical">
                        <div>{status.timestamp}</div>
                        <div>{status.executionStatus}</div>
                      </Space>
                    }>
                    <SVGIcons
                      alt="result"
                      className="tw-w-6 mr-2 mb-2"
                      icon={getStatusBadgeIcon(status.executionStatus)}
                    />
                  </Tooltip>
                ))}
              </div>
            </Col>
          </Row>
        );
      })}
    </Card>
  );
};

export default TreeViewTab;
