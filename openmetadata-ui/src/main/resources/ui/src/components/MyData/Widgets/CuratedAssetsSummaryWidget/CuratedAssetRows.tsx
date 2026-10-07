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
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CuratedAsset } from '../../../../hooks/useCuratedAssets';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';

export interface CuratedAssetRowsProps {
  assets: CuratedAsset[];
}

/** The matched assets, one linked row each, two to a line where there is room. */
const CuratedAssetRows: React.FC<CuratedAssetRowsProps> = ({ assets }) => {
  const { t } = useTranslation();

  if (assets.length === 0) {
    return null;
  }

  return (
    <div className="tw:@container tw:mt-4">
      <ul
        className="tw:grid tw:grid-cols-1 tw:gap-2 tw:@md:grid-cols-2"
        data-testid="curated-assets-rows">
        {assets.map((asset) => (
          <li data-testid={`curated-asset-${asset.name}`} key={asset.id}>
            <Link
              className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5 tw:rounded-lg tw:bg-secondary tw:px-3 tw:py-2.5"
              to={entityUtilClassBase.getEntityLink(
                asset.entityType,
                asset.fullyQualifiedName
              )}>
              {asset.serviceType && (
                <img
                  alt=""
                  className="tw:size-4 tw:shrink-0 tw:object-contain"
                  height={16}
                  src={serviceUtilClassBase.getServiceLogo(asset.serviceType)}
                  width={16}
                />
              )}
              <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
                {/* `!` on the colours throughout: Typography renders `.prose`,
                  whose unlayered `color` rule is emitted after the Tailwind
                  utilities. */}
                <Typography
                  className="tw:min-w-0 tw:text-text-primary!"
                  ellipsis={{ rows: 1 }}
                  size="text-sm">
                  {asset.name}
                </Typography>
                {asset.tier && (
                  <Typography
                    className="tw:min-w-0 tw:text-text-tertiary!"
                    ellipsis={{ rows: 1 }}
                    size="text-xs">
                    {asset.tier}
                  </Typography>
                )}
              </span>
              <span
                // Colour alone must not carry the meaning, so the dot has
                // a text alternative for assistive tech.
                aria-label={
                  asset.isHealthy ? t('label.healthy') : t('label.failing')
                }
                className={`tw:size-2 tw:shrink-0 tw:rounded-full ${
                  asset.isHealthy
                    ? 'tw:bg-utility-success-500'
                    : 'tw:bg-utility-error-500'
                }`}
                role="img"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CuratedAssetRows;
