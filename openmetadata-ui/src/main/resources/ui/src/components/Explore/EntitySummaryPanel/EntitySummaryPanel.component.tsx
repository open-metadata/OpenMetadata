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
import { Col, Divider, Row, Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../enums/search.enum';
import { TableType } from '../../../generated/entity/data/table';
import TableDataCardTitle from '../../common/table-data-card-v2/TableDataCardTitle.component';
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
      <Row className={classNames('m-md')}>
        <Col span={24}>
          <TableDataCardTitle
            searchIndex={SearchIndex.TABLE}
            source={entityDetails}
          />
        </Col>
        <Col span={24}>
          <Row>
            {Object.keys(basicTableInfo).map((fieldName) => (
              <Col key={fieldName} span={24}>
                <Row gutter={16}>
                  <Col className="text-gray" span={10}>
                    {fieldName}
                  </Col>
                  <Col span={12}>
                    {basicTableInfo[fieldName as keyof BasicTableInfo]}
                  </Col>
                </Row>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
      <Divider className="m-0" />
      <Row className={classNames('m-md')} gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text className="section-header">
            {t('label.profiler-amp-data-quality')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <Row gutter={[16, 16]}>
            {overallSummery.map((field) => (
              <Col key={field.title} span={10}>
                <Row>
                  <Col span={24}>
                    <Typography.Text className="text-gray">
                      {field.title}
                    </Typography.Text>
                  </Col>
                  <Col span={24}>
                    <Typography.Title
                      className={classNames(
                        'summary-panel-statistics-count',
                        field.className
                      )}
                      level={3}>
                      {field.value}
                    </Typography.Title>
                  </Col>
                </Row>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>
      <Divider className="m-0" />
      <Row className={classNames('m-md')} gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text className="section-header">
            {t('label.schema')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <ColumnSummary columns={columns} />
        </Col>
      </Row>
      <CloseOutlined className="close-icon" onClick={handleClosePanel} />
    </div>
  );
}
