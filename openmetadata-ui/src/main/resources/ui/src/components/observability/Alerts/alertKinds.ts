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
import { getSettingPageEntityBreadCrumb } from '../../../utils/GlobalSettingsUtils';
import { getNotificationAlertDetailsPath } from '../../../utils/RouterUtils';
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
  // Passing an entity name makes the Notifications crumb a link; the trailing
  // entity crumb (no url) is dropped because each page appends its own.
  getRootBreadcrumbs: (t) =>
    getSettingPageEntityBreadCrumb(
      GlobalSettingsMenuCategory.NOTIFICATIONS,
      String(t('label.alert-plural'))
    )
      .filter(({ url }) => Boolean(url))
      .map(({ name, url }) => ({ label: name, ariaLabel: name, href: url })),
  titleKey: 'label.notification-plural',
};
