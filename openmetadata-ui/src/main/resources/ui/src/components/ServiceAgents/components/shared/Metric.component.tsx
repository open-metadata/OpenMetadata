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

import { Box } from '@openmetadata/ui-core-components';
import { FC, ReactNode } from 'react';

interface MetricProps {
  icon: ReactNode;
  label?: string;
  tone?: 'error' | 'warn';
  value: ReactNode;
}

const VALUE_CLASS: Record<string, string> = {
  error: 'tw:text-utility-error-700',
  warn: 'tw:text-utility-warning-700',
};

const ICON_CLASS: Record<string, string> = {
  error: 'tw:text-fg-error-secondary',
  warn: 'tw:text-fg-warning-secondary',
};

const Metric: FC<MetricProps> = ({ icon, label, tone, value }) => {
  const valueClass = (tone && VALUE_CLASS[tone]) ?? 'tw:text-primary';
  const iconClass = (tone && ICON_CLASS[tone]) ?? 'tw:text-quaternary';

  return (
    <Box align="center" className="tw:gap-1.5">
      <span className={`tw:grid tw:place-items-center ${iconClass}`}>
        {icon}
      </span>
      <span
        className={`tw:whitespace-nowrap tw:text-sm tw:font-semibold tw:tabular-nums ${valueClass}`}>
        {value}
      </span>
      {label && (
        <span className="tw:whitespace-nowrap tw:text-xs tw:text-tertiary">
          {label}
        </span>
      )}
    </Box>
  );
};

export default Metric;
