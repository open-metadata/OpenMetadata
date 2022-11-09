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

import { CloseOutlined } from '@ant-design/icons';
import { Col, Divider, Row, Space, Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TableType } from '../../../generated/entity/data/table';
import ColumnSummary from '../ColumnSummary/ColumnSummary.component';
import {
  BasicTableInfo,
  EntitySummaryPanelProps,
} from './EntitySummaryPanel.interface';
import './EntitySummaryPanel.style.less';

export default function EntitySummaryPanel({
  entityDetails,
  handleClosePanel,
  overallSummery,
  showPanel,
}: EntitySummaryPanelProps) {
  const { t } = useTranslation();

  const { tableType, columns, tableQueries } = entityDetails;

  const basicTableInfo: BasicTableInfo = {
    Type: tableType || TableType.Regular,
    Queries: tableQueries?.length ? `${tableQueries?.length}` : '-',
    Columns: columns?.length ? `${columns?.length}` : '-',
  };

  return (
    <div
      className={classNames(
        'summary-panel-container',
        showPanel ? 'show-panel' : ''
      )}>
      <Space
        className={classNames('basic-info-container m-md')}
        direction="vertical">
        <Typography.Title level={5}>{entityDetails.name}</Typography.Title>
        <Space className={classNames('w-full')} direction="vertical">
          {Object.keys(basicTableInfo).map((fieldName) => (
            <Row gutter={16} key={fieldName}>
              <Col className="text-gray" span={10}>
                {fieldName}
              </Col>
              <Col span={12}>
                {basicTableInfo[fieldName as keyof BasicTableInfo]}
              </Col>
            </Row>
          ))}
        </Space>
      </Space>
      <Divider className="m-0" />
      <Space className={classNames('m-md')} direction="vertical">
        <Typography.Text className="section-header">
          {t('label.profiler-amp-data-quality')}
        </Typography.Text>
        <Row gutter={[16, 16]}>
          {overallSummery.map((field) => (
            <Col key={field.title} span={10}>
              <Space direction="vertical" size={6}>
                <Typography.Text className="text-gray">
                  {field.title}
                </Typography.Text>
                <Typography.Text
                  className={classNames(
                    'tw-text-2xl tw-font-semibold',
                    field.className
                  )}>
                  {field.value}
                </Typography.Text>
              </Space>
            </Col>
          ))}
        </Row>
      </Space>
      <Divider className="m-0" />
      <Space className={classNames('m-md')} direction="vertical">
        <Typography.Text className="section-header">
          {t('label.schema')}
        </Typography.Text>
        <ColumnSummary columns={columns} />
      </Space>
      <CloseOutlined className="close-icon" onClick={handleClosePanel} />
    </div>
  );
}
