/*
 *  Copyright 2023 Collate.
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

import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
// eslint-disable-next-line openmetadata-imports/no-lower-layer-page-imports -- Spark extension point lives there
import profilerConfigurationClassBase from '../../../../../../pages/ProfilerConfigurationPage/ProfilerConfigurationClassBase';
import SettingsSection, { ReadOnlyRow } from '../../components/SettingsSection';
import type { PlatformSettingsPageProps } from './PlatformSettings.types';
import { fetchProfilerConfig, isAllMetrics } from './ProfilerSettings.utils';
import { SettingsSkeleton } from './SettingsFormLayout';
import SettingValue from './SettingValue';
import { useEditHeaderAction } from './useEditHeaderAction';
import { useSettingsFetch } from './useSettingsFetch';

const ProfilerSettings = (props: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  const { data: config, isLoading } = useSettingsFetch(fetchProfilerConfig);
  useEditHeaderAction('profiler-configuration', isLoading, props);

  // Collate contributes the Spark agent section; OSS has none.
  const SparkAgentConfig = useMemo(
    () => profilerConfigurationClassBase.getSparkAgentConfigComponent(),
    []
  );

  if (isLoading || !config) {
    return <SettingsSkeleton rows={6} />;
  }

  const enabledLabel = (value?: boolean) =>
    value ? t('label.enabled') : t('label.disabled');

  return (
    <Box data-testid="profiler-settings" direction="col" gap={8}>
      <SettingsSection title={t('label.metric-configuration')}>
        {config.metricConfiguration.length === 0 && (
          <ReadOnlyRow
            description={t('message.metric-configuration-description')}
            title={t('label.metric-configuration')}>
            <SettingValue testId="metric-configuration-empty" />
          </ReadOnlyRow>
        )}
        {config.metricConfiguration.map((row, index) => (
          <ReadOnlyRow
            key={row.dataType ?? index}
            testId={`metric-row-${row.dataType}`}
            title={row.dataType ?? ''}>
            <Box
              align="center"
              className="tw:justify-end"
              direction="row"
              gap={1}
              wrap="wrap">
              {row.disabled && (
                <Badge color="gray" size="sm" type="pill-color">
                  {t('label.disabled')}
                </Badge>
              )}
              {isAllMetrics(row.metrics) ? (
                <Badge color="brand" size="sm" type="color">
                  {t('label.all')}
                </Badge>
              ) : (
                row.metrics?.map((metric) => (
                  <Badge color="brand" key={metric} size="sm" type="color">
                    {startCase(metric)}
                  </Badge>
                ))
              )}
              {!row.disabled && !row.metrics?.length && <SettingValue />}
            </Box>
          </ReadOnlyRow>
        ))}
      </SettingsSection>

      <Box direction="col" gap={2}>
        <SettingsSection title={t('label.sample-data-ingestion-configuration')}>
          <ReadOnlyRow
            description={t('message.enable-storing-sample-data-description')}
            title={t('label.enable-storing-of-sample-data')}>
            <SettingValue
              testId="store-sample-data-value"
              value={enabledLabel(config.sampleDataConfig?.storeSampleData)}
            />
          </ReadOnlyRow>
          <ReadOnlyRow
            description={t('message.enable-reading-sample-data-description')}
            title={t('label.enable-reading-of-sample-data')}>
            <SettingValue
              testId="read-sample-data-value"
              value={enabledLabel(config.sampleDataConfig?.readSampleData)}
            />
          </ReadOnlyRow>
        </SettingsSection>
        <Typography className="tw:px-1 tw:text-tertiary" size="text-xs">
          {t('message.sample-data-ingestion-config-description')}
        </Typography>
      </Box>

      {SparkAgentConfig && <SparkAgentConfig />}
    </Box>
  );
};

export default ProfilerSettings;
