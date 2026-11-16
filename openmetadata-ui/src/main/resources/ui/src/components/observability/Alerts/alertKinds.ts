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
import { AlertType } from '../../../generated/events/eventSubscription';
import { OBSERVABILITY_ROUTES } from '../observability.constants';
import { getObservabilityRootBreadcrumb } from '../observabilityBreadcrumb.utils';
import { getAlertsObservabilityDetailsPath } from './alertUtils';

type BreadcrumbItem = Omit<BreadcrumbItemType, 'id'>;

/**
 * Where the AI alert pages (list, details, add/edit modal) live and how they
 * are titled. Notification alerts are served by the settings modal's
 * Notification panel, so observability is the only kind.
 */
export interface AlertKind {
  alertType: AlertType.Observability;
  listPath: string;
  getDetailsPath: (fqn: string, tab?: string) => string;
  getRootBreadcrumbs: (t: TFunction) => BreadcrumbItem[];
  titleKey: string;
}

export const OBSERVABILITY_ALERT_KIND: AlertKind = {
  alertType: AlertType.Observability,
  listPath: OBSERVABILITY_ROUTES.OBSERVABILITY_ALERTS,
  getDetailsPath: getAlertsObservabilityDetailsPath,
  getRootBreadcrumbs: (t) => [getObservabilityRootBreadcrumb(t)],
  titleKey: 'label.observability-alert',
};
