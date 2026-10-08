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

import { Badge, Box, Button } from '@openmetadata/ui-core-components';
import { RefreshCw01 } from '@openmetadata/ui-core-components/icons';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StepValidation } from '../../../../../../generated/system/validationResponse';
import { fetchOMStatus } from '../../../../../../rest/miscAPI';
import HealthCheckCard from './HealthCheckCard';
import type { PlatformSettingsPageProps } from './PlatformSettings.types';
import { SettingsSkeleton } from './SettingsFormLayout';
import { useSettingsFetch } from './useSettingsFetch';

const HealthCheckSettings = ({
  onSetHeaderActions,
}: Pick<PlatformSettingsPageProps, 'onSetHeaderActions'>) => {
  const { t } = useTranslation();
  const { data: status, isLoading, reload } = useSettingsFetch(fetchOMStatus);

  const steps = useMemo(
    () =>
      Object.entries(status ?? {}).filter(
        (entry): entry is [string, StepValidation] => Boolean(entry[1])
      ),
    [status]
  );
  const passingCount = steps.filter(([, step]) => step.passed).length;
  const failingCount = steps.length - passingCount;

  useEffect(() => {
    onSetHeaderActions(
      <Button
        color="primary"
        data-testid="refresh-health-check"
        iconLeading={RefreshCw01}
        isLoading={isLoading}
        size="sm"
        onPress={reload}>
        {t('label.refresh')}
      </Button>
    );

    return () => onSetHeaderActions(undefined);
  }, [isLoading, onSetHeaderActions, reload, t]);

  if (isLoading) {
    return <SettingsSkeleton rows={6} />;
  }

  return (
    <Box data-testid="health-check-settings" direction="col" gap={5}>
      <Box direction="row" gap={2}>
        <Badge
          color="success"
          data-testid="passing-count"
          size="md"
          type="pill-color">
          {`${passingCount} ${t('label.passing')}`}
        </Badge>
        {failingCount > 0 && (
          <Badge
            color="error"
            data-testid="failing-count"
            size="md"
            type="pill-color">
            {`${failingCount} ${t('label.failed')}`}
          </Badge>
        )}
      </Box>
      {steps.map(([name, validation]) => (
        <HealthCheckCard key={name} name={name} validation={validation} />
      ))}
    </Box>
  );
};

export default HealthCheckSettings;
