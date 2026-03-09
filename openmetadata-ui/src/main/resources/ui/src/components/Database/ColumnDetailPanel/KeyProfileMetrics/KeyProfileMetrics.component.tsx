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
import { Tooltip, TooltipTrigger } from '@openmetadata/ui-core-components';
import { HelpCircle } from '@untitledui/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getKeyProfileMetrics } from '../../../../utils/TableProfilerUtils';
import {
  KeyProfileMetricsProps,
  ProfileMetric,
} from './KeyProfileMetrics.interface';

export const KeyProfileMetrics = ({ profile }: KeyProfileMetricsProps) => {
  const { t } = useTranslation();

  const metrics: ProfileMetric[] = useMemo(
    () => getKeyProfileMetrics(profile, t),
    [profile, t]
  );

  const sectionClassName =
    'tw:border-b-[0.6px] tw:border-tertiary tw:-mt-2 tw:pb-4 tw:px-4';
  const titleClassName = 'tw:text-[13px] tw:font-semibold tw:mb-1.5';

  return (
    <div className={sectionClassName}>
      <p className={titleClassName}>{t('label.key-profile-metric-plural')}</p>
      <div className="tw:flex tw:flex-nowrap tw:gap-2">
        {metrics.map((metric) => (
          <div
            className="tw:flex-1 tw:rounded-lg tw:bg-secondary tw:p-2"
            data-testid={`key-profile-metric-${metric.label}`}
            key={metric.label}>
            <div className="tw:flex tw:flex-col tw:gap-1">
              <div className="tw:flex tw:items-center tw:gap-1">
                <span className="tw:text-xs tw:font-medium tw:text-tertiary">
                  {metric.label}
                </span>
                {metric.tooltip && (
                  <Tooltip placement="top" title={metric.tooltip}>
                    <TooltipTrigger>
                      <HelpCircle className="tw:size-2.5 tw:text-tertiary" />
                    </TooltipTrigger>
                  </Tooltip>
                )}
              </div>
              <span className="tw:text-md tw:font-semibold tw:text-primary">
                {metric.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
