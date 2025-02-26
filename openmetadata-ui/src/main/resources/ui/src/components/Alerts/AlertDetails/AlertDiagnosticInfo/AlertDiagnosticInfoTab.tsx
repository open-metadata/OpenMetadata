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
import { Card, Col, Row, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GRAYED_OUT_COLOR } from '../../../../constants/constants';
import { EventSubscriptionDiagnosticInfo } from '../../../../generated/events/api/eventSubscriptionDiagnosticInfo';
import { getDiagnosticInfo } from '../../../../rest/observabilityAPI';
import { getDiagnosticItems } from '../../../../utils/Alerts/AlertsUtil';
import { showErrorToast } from '../../../../utils/ToastUtils';
import './alert-diagnostic-info-tab.less';
import { AlertDiagnosticInfoTabProps } from './AlertDiagnosticInfoTab.interface';

function AlertDiagnosticInfoTab({ fqn }: AlertDiagnosticInfoTabProps) {
  const { t } = useTranslation();
  const { Text } = Typography;
  const [diagnosticData, setDiagnosticData] =
    useState<EventSubscriptionDiagnosticInfo>();

  const fetchDiagnosticInfo = useCallback(async () => {
    try {
      const diagnosticInfoData = await getDiagnosticInfo(fqn);
      setDiagnosticData(diagnosticInfoData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [fqn]);

  useEffect(() => {
    fetchDiagnosticInfo();
  }, [fetchDiagnosticInfo]);

  const diagnosticItems = useMemo(
    () => getDiagnosticItems(diagnosticData, t),
    [diagnosticData, t]
  );

  return (
    <Card>
      <Row className="w-full" gutter={[16, 16]}>
        {diagnosticItems.map((item) => (
          <Col key={item.key} span={12}>
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
                <Text>
                  {typeof item.value === 'boolean'
                    ? item.value
                      ? 'Yes'
                      : 'No'
                    : item.value}
                </Text>
              </Col>
            </Row>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

export default React.memo(AlertDiagnosticInfoTab);
