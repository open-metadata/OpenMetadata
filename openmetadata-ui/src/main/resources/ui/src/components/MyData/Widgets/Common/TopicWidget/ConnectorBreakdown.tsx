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

import { Typography } from '@openmetadata/ui-core-components';
import { getSeriesColor } from '@openmetadata/ui-core-components/charts';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ConnectorCount } from '../../../../../hooks/useDataEstate';
import ShareBar, { ShareSegment } from './ShareBar';

export interface ConnectorBreakdownProps {
  connectors: ConnectorCount[];
  format: (value: number) => string;
  className?: string;
}

/** The stacked share bar plus its legend, one series per connector. */
const ConnectorBreakdown: React.FC<ConnectorBreakdownProps> = ({
  connectors,
  format,
  className,
}) => {
  const { t } = useTranslation();

  // Categorical colours come from the charts palette, so the legend swatch and
  // its segment can never drift apart.
  const segments = useMemo<ShareSegment[]>(
    () =>
      connectors.map((connector, index) => ({
        color: getSeriesColor(index),
        key: connector.key,
        name: connector.name,
        value: connector.count,
      })),
    [connectors]
  );

  if (segments.every((segment) => segment.value === 0)) {
    return null;
  }

  return (
    <div className={className} data-testid="connector-breakdown">
      <ShareBar
        ariaLabel={t('label.by-connector')}
        className="tw:h-2"
        segments={segments}
        valueFormatter={format}
      />

      {/* Cased in CSS, not in the string: a locale whose script has no case
        must not be handed a pre-uppercased translation. */}
      <Typography
        className="tw:mt-3 tw:block tw:uppercase tw:tracking-wide tw:text-text-tertiary!"
        size="text-xs"
        weight="semibold">
        {t('label.by-connector')}
      </Typography>

      {/* Wrapping flex, not a grid. A grid gives every entry the widest
        entry's column, so a short name and a long count sit metres apart and
        the row count is fixed by the breakpoint rather than by what fits. The
        design packs entries at their natural width and lets them wrap, which
        is why its rows hold two, then two, then three. */}
      <ul className="tw:mt-2 tw:flex tw:flex-wrap tw:gap-x-[18px] tw:gap-y-2.5">
        {segments.map((segment) => (
          <li
            className="tw:inline-flex tw:max-w-full tw:items-center tw:gap-1.5"
            data-testid="connector-entry"
            key={segment.key}>
            <span
              aria-hidden
              className="tw:size-2 tw:shrink-0 tw:rounded-xs"
              style={{ backgroundColor: segment.color }}
            />
            <Typography
              className="tw:text-text-secondary!"
              data-testid="connector-name"
              size="text-sm">
              {segment.name}
            </Typography>
            <Typography
              className="tw:shrink-0 tw:text-text-primary!"
              data-testid="connector-count"
              size="text-sm"
              weight="medium">
              {format(segment.value)}
            </Typography>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ConnectorBreakdown;
