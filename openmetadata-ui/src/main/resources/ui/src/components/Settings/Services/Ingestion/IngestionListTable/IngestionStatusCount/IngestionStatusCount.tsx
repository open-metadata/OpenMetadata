/*
 *  Copyright 2025 Collate.
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
import { Col, Row, Typography } from 'antd';
import classNames from 'classnames';
import { useMemo } from 'react';
import { getIngestionStatusCountData } from '../../../../../../utils/IngestionUtils';
import './ingestion-status-count.less';
import { IngestionStatusCountProps } from './IngestionStatusCount.interface';

function IngestionStatusCount({
  summary,
  runId,
}: Readonly<IngestionStatusCountProps>) {
  const records = useMemo(
    () => getIngestionStatusCountData(summary),
    [summary]
  );

  return (
    <Row
      align="middle"
      className="ingestion-status-count"
      gutter={[4, 4]}
      justify="space-evenly"
      wrap={false}>
      {records.map((record) => (
        <Col key={`${record.label}-${runId}`}>
          <div className={classNames('status-count', record.type)}>
            <Typography.Text className="record-count">
              {record.value}
            </Typography.Text>
            <Typography.Text className="record-label">
              {record.label}
            </Typography.Text>
          </div>
        </Col>
      ))}
    </Row>
  );
}

export default IngestionStatusCount;
