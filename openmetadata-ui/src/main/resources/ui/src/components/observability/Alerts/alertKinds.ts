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

import { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import { TFunction } from 'i18next';
import { ROUTES } from '../../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import { AlertType } from '../../../generated/events/eventSubscription';
import {
  getNotificationAlertDetailsPath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import { OBSERVABILITY_ROUTES } from '../observability.constants';
import { getObservabilityRootBreadcrumb } from '../observabilityBreadcrumb.utils';
import { getAlertsObservabilityDetailsPath } from './alertUtils';

type BreadcrumbItem = Omit<BreadcrumbItemType, 'id'>;

/**
 * What differs between the alert types the AI alert pages serve. Everything
 * else (list, details, add/edit modal) is shared, so Observability and
 * Settings → Notifications render the same AI pages.
 */
export interface AlertKind {
  alertType: AlertType.Observability | AlertType.Notification;
  /** Notification lists also show the system `ActivityFeedAlert` (read-only). */
  includeSystemAlerts: boolean;
  /** Notification alerts have no trigger (action) section. */
  hasTriggers: boolean;
  listPath: string;
  getDetailsPath: (fqn: string, tab?: string) => string;
  getRootBreadcrumbs: (t: TFunction) => BreadcrumbItem[];
  titleKey: string;
}

export const OBSERVABILITY_ALERT_KIND: AlertKind = {
  alertType: AlertType.Observability,
  includeSystemAlerts: false,
  hasTriggers: true,
  listPath: OBSERVABILITY_ROUTES.OBSERVABILITY_ALERTS,
  getDetailsPath: getAlertsObservabilityDetailsPath,
  getRootBreadcrumbs: (t) => [getObservabilityRootBreadcrumb(t)],
  titleKey: 'label.observability-alert',
};

export const NOTIFICATION_ALERT_KIND: AlertKind = {
  alertType: AlertType.Notification,
  includeSystemAlerts: true,
  hasTriggers: false,
  listPath: ROUTES.NOTIFICATION_ALERT_LIST,
  getDetailsPath: getNotificationAlertDetailsPath,
  getRootBreadcrumbs: (t) => {
    const settings = String(t('label.setting-plural'));
    const notifications = String(t('label.notification-plural'));

    return [
      { label: settings, ariaLabel: settings, href: ROUTES.SETTINGS },
      {
        label: notifications,
        ariaLabel: notifications,
        href: getSettingPath(GlobalSettingsMenuCategory.NOTIFICATIONS),
      },
    ];
  },
  titleKey: 'label.notification-plural',
};
