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

import { FC, ReactNode } from 'react';

interface MetricProps {
  icon: ReactNode;
  label?: string;
  tone?: 'error' | 'warn';
  value: ReactNode;
}

const Metric: FC<MetricProps> = ({ icon, label, tone, value }) => {
  const valueColor =
    tone === 'error'
      ? 'var(--error-700)'
      : tone === 'warn'
      ? 'var(--warning-700)'
      : 'var(--fg-primary)';
  const iconColor =
    tone === 'error'
      ? 'var(--error-500)'
      : tone === 'warn'
      ? 'var(--warning-500)'
      : 'var(--fg-muted)';

  return (
    <div className="tw:flex tw:items-center tw:gap-1.5">
      <span
        className="tw:grid tw:place-items-center"
        style={{ color: iconColor }}>
        {icon}
      </span>
      <span
        className="tw:whitespace-nowrap tw:text-sm tw:font-semibold tw:tabular-nums"
        style={{ color: valueColor }}>
        {value}
      </span>
      {label && (
        <span className="tw:whitespace-nowrap tw:text-xs tw:text-[color:var(--fg-tertiary)]">
          {label}
        </span>
      )}
    </div>
  );
};

export default Metric;
