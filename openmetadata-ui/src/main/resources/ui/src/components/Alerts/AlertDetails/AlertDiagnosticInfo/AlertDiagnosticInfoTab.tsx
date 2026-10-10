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
import {
  Grid,
  SkeletonParagraph,
  Typography,
} from '@openmetadata/ui-core-components';
import { Card, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { GRAYED_OUT_COLOR } from '../../../../constants/constants';
import { EventSubscriptionDiagnosticInfo } from '../../../../generated/events/api/eventSubscriptionDiagnosticInfo';
import { useFqn } from '../../../../hooks/useFqn';
import { getDiagnosticInfo } from '../../../../rest/observabilityAPI';
import { getDiagnosticItems } from '../../../../utils/Alerts/AlertsUtilPure';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';
import { showErrorToast } from '../../../../utils/ToastUtils';

function AlertDiagnosticInfoTab() {
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
      {diagnosticIsLoading ? (
        <SkeletonParagraph rows={3} />
      ) : (
        <Grid
          className="layout-row layout-grid w-full"
          style={{ ...getLayoutGutter(16, 16) }}>
          {diagnosticItems.map((item) => (
            <Grid.Item className="layout-column" key={item.key} span={12}>
              <Grid className="layout-row layout-grid tw:items-center">
                <Grid.Item
                  className="layout-column d-flex items-center"
                  span={12}>
                  <Typography className="d-flex items-center gap-1">
                    <Typography className="m-0" color="secondary">
                      {`${item.key}:`}
                    </Typography>
                    <Tooltip placement="bottom" title={item.description}>
                      <InfoCircleOutlined
                        className="info-icon"
                        style={{ color: GRAYED_OUT_COLOR }}
                      />
                    </Tooltip>
                  </Typography>
                </Grid.Item>
                <Grid.Item className="layout-column" span={12}>
                  <Typography>{formatValue(item.value)}</Typography>
                </Grid.Item>
              </Grid>
            </Grid.Item>
          ))}
        </Grid>
      )}
    </Card>
  );
}

export default memo(AlertDiagnosticInfoTab);
