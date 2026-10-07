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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { EntityIconSize } from '../../../utils/EntityIconUtils';
import { getEntityLinkFromType } from '../../../utils/EntityLinkUtils';
import { getEntityIcon } from '../../../utils/LandingPageWidgetIconUtils';
import { getRecentlyViewedData } from '../../../utils/RecentActivityUtils';

/**
 * The assets this user opened most recently.
 *
 * Read once on mount rather than subscribed: the list is written while the user
 * is on an entity page, and getting back here is always a navigation, so there
 * is no in-place update to miss. It is local to the browser — a user signing in
 * elsewhere starts with an empty rail, which is why the row disappears entirely
 * rather than showing an empty state that would read as data loss.
 */
const RecentlyViewedRail: React.FC = () => {
  const { t } = useTranslation();

  const recentlyViewed = useMemo(
    () =>
      getRecentlyViewedData().map((entity) => ({
        entityType: entity.entityType,
        fqn: entity.fqn,
        icon: getEntityIcon(
          {
            entityType: entity.entityType,
            name: entity.displayName,
            serviceType: entity.serviceType,
          },
          EntityIconSize.Size16
        ),
        id: entity.id,
        name: entity.displayName ?? entity.fqn,
      })),
    []
  );

  if (recentlyViewed.length === 0) {
    return null;
  }

  return (
    <section data-testid="recently-viewed-rail">
      {/* `!` on the colour: Typography renders `.prose`, whose unlayered
        `color` rule is emitted after the Tailwind utilities. */}
      <Typography
        className="tw:text-text-tertiary! tw:uppercase"
        size="text-xs"
        weight="semibold">
        {t('label.recently-viewed')}
      </Typography>

      <ul className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
        {recentlyViewed.map((entity) => (
          <li key={entity.id}>
            <Link
              className="tw:flex tw:max-w-60 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:px-3 tw:py-2"
              data-testid="recently-viewed-asset"
              to={getEntityLinkFromType(
                entity.fqn,
                entity.entityType as EntityType
              )}>
              <span className="tw:flex tw:shrink-0 tw:items-center">
                {entity.icon}
              </span>
              <Typography
                className="tw:min-w-0 tw:text-text-primary!"
                ellipsis={{ rows: 1 }}
                size="text-sm">
                {entity.name}
              </Typography>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RecentlyViewedRail;
