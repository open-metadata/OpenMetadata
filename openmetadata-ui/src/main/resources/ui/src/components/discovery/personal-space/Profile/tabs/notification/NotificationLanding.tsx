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

import { Box, Card, Typography } from '@openmetadata/ui-core-components';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import {
  EXTENSION_POINTS,
  NotificationSectionContribution,
} from '../../../../../../utils/ExtensionPointTypes';
import { useApplicationsProvider } from '../../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { ALERTS_LANDING_CARD } from './Notification.constants';
import type {
  NotificationLandingCard,
  NotificationLandingProps,
} from './Notification.types';
import {
  buildSectionCards,
  getNotificationMenuItems,
} from './Notification.utils';

const NotificationLanding: FC<NotificationLandingProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  // `contributionsVersion` changes once plugins have contributed; the registry's
  // identity never does, so memoizing on it alone would miss late sections.
  const { extensionRegistry, contributionsVersion } = useApplicationsProvider();

  const cards = useMemo<NotificationLandingCard[]>(() => {
    const alertsCard: NotificationLandingCard = {
      id: ALERTS_LANDING_CARD.id,
      icon: ALERTS_LANDING_CARD.icon,
      title: t(ALERTS_LANDING_CARD.titleKey),
      description: t(ALERTS_LANDING_CARD.descriptionKey),
      view: ALERTS_LANDING_CARD.view,
    };

    // Downstream builds (e.g. Collate) contribute extra Notification sections;
    // their cards come from the global-settings Notifications menu.
    const contributions =
      extensionRegistry.getContributions<NotificationSectionContribution>(
        EXTENSION_POINTS.NOTIFICATION_LANDING_SECTIONS
      );

    if (contributions.length === 0) {
      return [alertsCard];
    }

    return [
      alertsCard,
      ...buildSectionCards(
        getNotificationMenuItems(permissions),
        contributions
      ),
    ];
    // contributionsVersion is the only signal that plugins have registered their
    // sections; removing it as "unnecessary" hides the downstream cards.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [extensionRegistry, contributionsVersion, permissions, t]);

  return (
    <Box
      className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-5 tw:px-8 tw:pb-8"
      data-testid="notification-landing">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card
            isClickable
            key={card.id}
            role="button"
            size="md"
            tabIndex={0}
            onClick={() => onNavigate(card.view)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigate(card.view);
              }
            }}>
            <Card.Content>
              <Box
                align="start"
                data-testid={`notification-card-${card.id}`}
                direction="row"
                gap={4}>
                <Box
                  align="center"
                  className="tw:shrink-0 tw:rounded-lg tw:bg-secondary tw:h-10 tw:w-10"
                  justify="center">
                  <Icon className="tw:size-6 tw:text-secondary" />
                </Box>
                <Box className="tw:min-w-0" direction="col" gap={1}>
                  <Typography
                    className="tw:text-primary"
                    size="text-sm"
                    weight="semibold">
                    {card.title}
                  </Typography>
                  <Typography
                    className="tw:text-tertiary tw:line-clamp-2"
                    size="text-sm"
                    weight="regular">
                    {card.description}
                  </Typography>
                </Box>
              </Box>
            </Card.Content>
          </Card>
        );
      })}
    </Box>
  );
};

export default NotificationLanding;
