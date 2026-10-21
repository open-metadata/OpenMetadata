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

import { Badge, Typography } from '@openmetadata/ui-core-components';
import React from 'react';
import { AssetTypeCount } from '../../../../hooks/useTotalDataAssets';
import { getEntityNameLabel } from '../../../../utils/EntityNameUtils';
import { deltaColor } from './TotalDataAssetsWidget.utils';

export interface AssetTypeRowsProps {
  assetTypes: AssetTypeCount[];
  /** Swatch colour per row, in the same order the share bar draws them. */
  colors: string[];
  formatCount: (value: number) => string;
  formatShare: (value: number) => string;
  formatDelta: (value: number) => string;
}

/**
 * One row per asset type: swatch, name, share, count and its change.
 *
 * The rows share one grid (each row is a subgrid), so every column is as wide
 * as its widest cell: a large count or a "+115,264" badge widens its column
 * for all rows instead of overlapping its neighbour, and the columns stay
 * aligned whether or not a row has moved.
 */
const AssetTypeRows: React.FC<AssetTypeRowsProps> = ({
  assetTypes,
  colors,
  formatCount,
  formatShare,
  formatDelta,
}) => (
  <ul
    className="tw:grid tw:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] tw:gap-x-3 tw:divide-y tw:divide-secondary"
    data-testid="asset-type-rows">
    {assetTypes.map((type, index) => (
      <li
        className="tw:col-span-full tw:grid tw:grid-cols-subgrid tw:items-center tw:py-2.5"
        data-testid={`asset-type-row-${type.key}`}
        key={type.key}>
        <span
          aria-hidden
          className="tw:size-2.5 tw:shrink-0 tw:rounded-xs"
          style={{ backgroundColor: colors[index] }}
        />
        <span className="tw:min-w-0">
          <Typography
            className="tw:text-text-primary!"
            ellipsis={{ rows: 1 }}
            size="text-sm">
            {getEntityNameLabel(type.key)}
          </Typography>
        </span>
        <Typography
          className="tw:text-right tw:tabular-nums tw:text-text-tertiary!"
          size="text-sm">
          {formatShare(type.share)}
        </Typography>
        <Typography
          className="tw:text-right tw:tabular-nums tw:text-text-primary!"
          data-testid="asset-type-count"
          size="text-sm"
          weight="medium">
          {formatCount(type.count)}
        </Typography>
        <span className="tw:flex tw:justify-end">
          {type.delta !== null && (
            <Badge
              color={deltaColor(type.delta)}
              data-testid="asset-type-delta"
              size="sm"
              type="pill-color">
              {formatDelta(type.delta)}
            </Badge>
          )}
        </span>
      </li>
    ))}
  </ul>
);

export default AssetTypeRows;
