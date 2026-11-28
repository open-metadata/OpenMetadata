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

import { FeaturedIcon, Typography } from '@openmetadata/ui-core-components';
import { isString } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CuratedAsset } from '../../../../hooks/useCuratedAssets';
import type { SearchSourceAlias } from '../../../../interface/search.interface';
import searchClassBase from '../../../../utils/SearchClassBase';
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
        {assets.map((asset) => {
          // `searchClassBase.getEntityLink` is the codebase-standard resolver
          // for search hits: it returns `''` for entity types with no
          // dedicated route (e.g. `query`, `folder`, `auditReport`) rather than
          // inventing a `/table/<fqn>` link. The `all` index the widget queries
          // when the config has `resources: ['all']` carries those un-linkable
          // types, so a row that can't be routed is rendered as a
          // non-interactive tile instead of a link to a table page that 404s.
          const link = searchClassBase.getEntityLink({
            entityType: asset.entityType,
            fullyQualifiedName: asset.fullyQualifiedName,
            id: asset.id,
            name: asset.name,
            serviceType: asset.serviceType,
          } as SearchSourceAlias);
          const href = isString(link) ? link : link.pathname;

          const rowContent = (
            <>
              {/* A white tile, so the logo reads against the tinted row. */}
              {asset.serviceType && (
                <FeaturedIcon
                  color="gray"
                  icon={
                    <img
                      alt=""
                      className="tw:size-4 tw:object-contain"
                      height={16}
                      src={serviceUtilClassBase.getServiceLogo(
                        asset.serviceType
                      )}
                      width={16}
                    />
                  }
                  size="sm"
                  theme="modern"
                />
              )}
              <span className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
                {/* `!` on the colours throughout: Typography renders `.prose`,
                  whose unlayered `color` rule is emitted after the Tailwind
                  utilities. */}
                <Typography
                  className="tw:min-w-0 tw:text-text-primary!"
                  ellipsis={{ rows: 1 }}
                  size="text-xs">
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
              {/* Only once the test lookup has answered: an unknown health
                gets no dot rather than a green nobody confirmed. */}
              {asset.isHealthy !== undefined && (
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
                  data-testid={`curated-asset-health-${asset.id}`}
                  role="img"
                />
              )}
            </>
          );

          return (
            <li data-testid={`curated-asset-${asset.name}`} key={asset.id}>
              {href ? (
                <Link
                  className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5 tw:rounded-lg tw:bg-secondary tw:px-3 tw:py-2.5 tw:no-underline!"
                  to={href}>
                  {rowContent}
                </Link>
              ) : (
                <div
                  className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5 tw:rounded-lg tw:bg-secondary tw:px-3 tw:py-2.5"
                  data-testid={`curated-asset-no-link-${asset.id}`}>
                  {rowContent}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CuratedAssetRows;
