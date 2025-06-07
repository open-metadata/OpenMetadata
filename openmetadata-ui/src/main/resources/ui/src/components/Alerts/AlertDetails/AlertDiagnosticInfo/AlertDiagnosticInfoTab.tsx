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
import { Card, Col, Row, Skeleton, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { GRAYED_OUT_COLOR } from '../../../../constants/constants';
import { EventSubscriptionDiagnosticInfo } from '../../../../generated/events/api/eventSubscriptionDiagnosticInfo';
import { useFqn } from '../../../../hooks/useFqn';
import { getDiagnosticInfo } from '../../../../rest/observabilityAPI';
import { getDiagnosticItems } from '../../../../utils/Alerts/AlertsUtil';
import { showErrorToast } from '../../../../utils/ToastUtils';

function AlertDiagnosticInfoTab() {
  const { Text } = Typography;
  const { fqn } = useFqn();
  const [diagnosticData, setDiagnosticData] =
    useState<EventSubscriptionDiagnosticInfo>();
  const [diagnosticIsLoading, setDiagnosticIsLoading] = useState(true);

  const fetchDiagnosticInfo = useCallback(async () => {
    try {
      setDiagnosticIsLoading(true);
      const diagnosticInfoData = await getDiagnosticInfo(fqn);
      setDiagnosticData(diagnosticInfoData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setDiagnosticIsLoading(false);
    }
  }, [fqn]);

  useEffect(() => {
    fetchDiagnosticInfo();
  }, []);

  const diagnosticItems = useMemo(
    () => getDiagnosticItems(diagnosticData),
    [diagnosticData]
  );

  const formatValue = (value: unknown): string => {
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    return String(value);
  };

  return (
    <Card>
      <Skeleton active loading={diagnosticIsLoading} paragraph={{ rows: 3 }}>
        <Row className="w-full" gutter={[16, 16]}>
          {diagnosticItems.map((item) => (
            <Col key={item.key} span={12}>
              <Row align="middle">
                <Col className="d-flex items-center" span={12}>
                  <Typography.Text className="d-flex items-center gap-1">
                    <Typography.Text className="m-0" type="secondary">
                      {`${item.key}:`}
                    </Typography.Text>
                    <Tooltip placement="bottom" title={item.description}>
                      <InfoCircleOutlined
                        className="info-icon"
                        style={{ color: GRAYED_OUT_COLOR }}
                      />
                    </Tooltip>
                  </Typography.Text>
                </Col>
                <Col span={12}>
                  <Text>{formatValue(item.value)}</Text>
                </Col>
              </Row>
            </Col>
          ))}
        </Row>
      </Skeleton>
    </Card>
  );
}

export default memo(AlertDiagnosticInfoTab);
