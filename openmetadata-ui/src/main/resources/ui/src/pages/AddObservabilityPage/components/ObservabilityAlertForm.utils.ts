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

import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  ModifiedCreateEventSubscription,
  ModifiedEventSubscription,
} from '../AddObservabilityPage.interface';

export const getClassicAlertInitialValues = (
  alert: ModifiedEventSubscription
): ModifiedCreateEventSubscription => ({
  name: alert.name,
  displayName: getEntityName(alert),
  description: alert.description,
  resources: alert.filteringRules?.resources ?? [],
  input: alert.input,
  destinations: alert.destinations,
  timeout: alert.timeout,
  readTimeout: alert.readTimeout,
  alertType: alert.alertType,
  provider: alert.provider,
  owners: alert.owners,
  notificationTemplate: alert.notificationTemplate,
});

export const getAlertSourceChanges = (
  next: string[],
  previous: string[]
): Partial<ModifiedCreateEventSubscription> => ({
  resources: next,
  input: {},
  ...(previous.some((source) => !next.includes(source))
    ? { destinations: [] }
    : {}),
});
