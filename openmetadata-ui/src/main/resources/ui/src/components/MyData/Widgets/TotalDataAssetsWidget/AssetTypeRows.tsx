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

/** One row per asset type: swatch, name, share, count and its change. */
const AssetTypeRows: React.FC<AssetTypeRowsProps> = ({
  assetTypes,
  colors,
  formatCount,
  formatShare,
  formatDelta,
}) => (
  <ul
    className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
    data-testid="asset-type-rows">
    {assetTypes.map((type, index) => (
      <li
        className="tw:flex tw:min-w-0 tw:items-center tw:gap-3 tw:py-2.5"
        data-testid={`asset-type-row-${type.key}`}
        key={type.key}>
        <span
          aria-hidden
          className="tw:size-2.5 tw:shrink-0 tw:rounded-xs"
          style={{ backgroundColor: colors[index] }}
        />
        {/* The span takes the free width; Typography's ellipsis box does not
          stretch as a flex item, so share and count would hug the name. */}
        <span className="tw:min-w-0 tw:flex-1">
          <Typography
            className="tw:text-text-primary!"
            ellipsis={{ rows: 1 }}
            size="text-sm">
            {getEntityNameLabel(type.key)}
          </Typography>
        </span>
        <Typography
          className="tw:shrink-0 tw:tabular-nums tw:text-text-tertiary!"
          size="text-sm">
          {formatShare(type.share)}
        </Typography>
        <Typography
          className="tw:min-w-10 tw:shrink-0 tw:text-right tw:tabular-nums tw:text-text-primary!"
          data-testid="asset-type-count"
          size="text-sm"
          weight="medium">
          {formatCount(type.count)}
        </Typography>
        {/* A fixed slot, so counts line up whether or not a row has moved. */}
        <span className="tw:flex tw:w-12 tw:shrink-0 tw:justify-end">
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
