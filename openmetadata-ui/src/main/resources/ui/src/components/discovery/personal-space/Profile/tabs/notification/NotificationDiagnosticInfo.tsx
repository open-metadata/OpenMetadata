/*
 *  Copyright 2026 Collate.
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

import {
  Box,
  ButtonUtility,
  Grid,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { InfoCircle } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { EventSubscriptionDiagnosticInfo } from '../../../../../../generated/events/api/eventSubscriptionDiagnosticInfo';
import { getDiagnosticInfo } from '../../../../../../rest/observabilityAPI';
import { getDiagnosticItems } from '../../../../../../utils/Alerts/AlertsUtilPure';
import { showErrorToast } from '../../../../../../utils/ToastUtils';

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
}

interface NotificationDiagnosticInfoProps {
  fqn: string;
  diagnosticData?: EventSubscriptionDiagnosticInfo;
}

function NotificationDiagnosticInfo({
  diagnosticData: diagnosticDataProp,
  fqn,
}: NotificationDiagnosticInfoProps) {
  const [fetchedData, setFetchedData] =
    useState<EventSubscriptionDiagnosticInfo>();
  const [diagnosticIsLoading, setDiagnosticIsLoading] = useState(
    !diagnosticDataProp
  );

  const diagnosticData = diagnosticDataProp ?? fetchedData;

  const fetchDiagnosticInfo = useCallback(async () => {
    try {
      setDiagnosticIsLoading(true);
      const diagnosticInfoData = await getDiagnosticInfo(fqn);
      setFetchedData(diagnosticInfoData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setDiagnosticIsLoading(false);
    }
  }, [fqn]);

  useEffect(() => {
    if (!diagnosticDataProp) {
      fetchDiagnosticInfo();
    }
  }, [diagnosticDataProp, fetchDiagnosticInfo]);

  const diagnosticItems = useMemo(
    () => getDiagnosticItems(diagnosticData),
    [diagnosticData]
  );

  if (diagnosticIsLoading) {
    return (
      <Grid
        className="tw:border tw:border-secondary tw:rounded-lg tw:p-4"
        colGap="4"
        gap="4">
        {Array.from({ length: 6 }, (_, i) => (
          <Grid.Item key={i} span={12}>
            <Skeleton height={20} variant="rounded" />
          </Grid.Item>
        ))}
      </Grid>
    );
  }

  return (
    <Grid
      className="tw:w-full tw:border tw:border-secondary tw:rounded-lg tw:p-4"
      colGap="4"
      data-testid="diagnostic-info-container"
      gap="4">
      {diagnosticItems.map((item) => (
        <Grid.Item key={item.key} span={12}>
          <Box align="center" direction="row" gap={2}>
          <Box
            align="center"
            className="tw:basis-48 tw:shrink-0"
            direction="row"
            gap={1}>
            <Typography className="tw:text-tertiary" size="text-sm">
              {`${item.key}:`}
            </Typography>
            <ButtonUtility
              className="tw:p-0"
              color="tertiary"
              icon={InfoCircle}
              size="xs"
              tooltip={String(item.description)}
            />
          </Box>
          <Typography className="tw:font-medium" size="text-sm">
            {formatValue(item.value)}
          </Typography>
          </Box>
        </Grid.Item>
      ))}
    </Grid>
  );
}

export default memo(NotificationDiagnosticInfo);
