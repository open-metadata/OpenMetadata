/*
 *  Copyright 2024 Collate.
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

import { InfoCircleOutlined } from '@ant-design/icons';
import { Card, Col, Input, Row, Tooltip } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GRAYED_OUT_COLOR } from '../../../../constants/constants';
import './alert-diagnostic-info-tab.less';
import { AlertDiagnosticInfoTabProps } from './AlertDiagnosticInfoTab.interface';

interface DiagnosticItem {
  key: string;
  value: string | number | boolean;
  description: string;
}

const DiagnosticItemRow = ({ item }: { item: DiagnosticItem }) => {
  const { t } = useTranslation();

  return (
    <Col span={12}>
      <Row align="middle">
        <Col className="d-flex items-center" span={10}>
          <span className="d-flex items-center gap-1">
            <p className="text-grey-muted m-0">{t(item.key)}:</p>
            <Tooltip placement="bottom" title={item.description}>
              <InfoCircleOutlined
                className="info-icon"
                style={{ color: GRAYED_OUT_COLOR }}
              />
            </Tooltip>
          </span>
        </Col>
        <Col span={10}>
          <Input
            readOnly
            className="w-full border-none"
            data-testid="input-field"
            value={
              typeof item.value === 'boolean'
                ? item.value
                  ? 'Yes'
                  : 'No'
                : item.value
            }
          />
        </Col>
      </Row>
    </Col>
  );
};

function AlertDiagnosticInfoTab({
  diagnosticData,
}: AlertDiagnosticInfoTabProps) {
  const diagnosticItems = useMemo(
    () => [
      {
        key: 'label.latest-offset',
        value: diagnosticData?.latestOffset,
        description: 'The latest offset of the event in the system.',
      },
      {
        key: 'label.current-offset',
        value: diagnosticData?.currentOffset,
        description: 'The current offset of the event subscription.',
      },
      {
        key: 'label.starting-offset',
        value: diagnosticData?.startingOffset,
        description:
          'The initial offset of the event subscription when it started processing.',
      },
      {
        key: 'label.successful-event-plural',
        value: diagnosticData?.successfulEventsCount,
        description: 'Count of successful events for specific alert.',
      },
      {
        key: 'label.failed-event-plural',
        value: diagnosticData?.failedEventsCount,
        description: 'Count of failed events for specific alert.',
      },
      {
        key: 'label.processed-all-event-plural',
        value: diagnosticData?.hasProcessedAllEvents,
        description: 'Indicates whether all events have been processed.',
      },
    ],
    [diagnosticData]
  );

  return (
    <Card>
      <Row className="w-full" gutter={[16, 16]}>
        {diagnosticItems.map((item) => (
          <DiagnosticItemRow item={item} key={item.key} />
        ))}
      </Row>
    </Card>
  );
}

export default React.memo(AlertDiagnosticInfoTab);
