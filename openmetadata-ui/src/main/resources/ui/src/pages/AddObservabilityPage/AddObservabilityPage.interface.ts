/*
 *  Copyright 2024 Collate.
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

import { AlertType } from '../../generated/events/eventSubscription';
import type {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
  ModifiedEventSubscription,
  ModifiedWebhookConfig,
} from '../../utils/AlertsClassBase.interface';

export type {
  UseAlertFormDataOptions,
  UseAlertFormDataReturn,
  UseObservabilityAlertResourcesReturn,
  UseObservabilityAlertTemplatesOptions,
  UseObservabilityAlertTemplatesReturn,
} from '../../interface/observability/alertForm.interface';
export type {
  ModifiedCreateEventSubscription,
  ModifiedDestination,
  ModifiedEventSubscription,
  ModifiedWebhookConfig,
};

export interface AddObservabilityPageProps {
  pageTitle: string;
  /** Notification alerts reuse this page; they have no trigger section. */
  alertType?: AlertType;
}
