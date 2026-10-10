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
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { TrackedAsset } from '../../../../../hooks/useOwnedAndFollowed';
import entityUtilClassBase from '../../../../../utils/EntityUtilClassBase';
import serviceUtilClassBase from '../../../../../utils/ServiceUtilClassBase';

export interface TrackedAssetListProps {
  title: string;
  assets: TrackedAsset[];
  dataTestId: string;
}

/** One column of the "Yours and followed" card: a heading and its asset rows. */
const TrackedAssetList: React.FC<TrackedAssetListProps> = ({
  title,
  assets,
  dataTestId,
}) => {
  const { t } = useTranslation();

  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2">
      {/* `!` on the colours throughout: Typography renders `.prose`, whose
        unlayered `color` rule is emitted after the Tailwind utilities. */}
      <Typography
        className="tw:text-text-tertiary! tw:uppercase"
        size="text-xs"
        weight="semibold">
        {title}
      </Typography>

      {assets.length === 0 ? (
        <Typography className="tw:text-text-tertiary!" size="text-sm">
          {t('message.no-data-available')}
        </Typography>
      ) : (
        <ul className="tw:flex tw:flex-col tw:gap-2" data-testid={dataTestId}>
          {assets.map((asset) => (
            <li data-testid={`${dataTestId}-${asset.name}`} key={asset.id}>
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
                <Typography
                  className="tw:min-w-0 tw:flex-1 tw:text-text-primary!"
                  ellipsis={{ rows: 1 }}
                  size="text-sm">
                  {asset.name}
                </Typography>
                <Badge
                  className="tw:shrink-0"
                  color={asset.hasChanged ? 'warning' : 'gray'}
                  size="sm"
                  type="pill-color">
                  {asset.hasChanged ? t('label.changed') : t('label.stable')}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TrackedAssetList;
