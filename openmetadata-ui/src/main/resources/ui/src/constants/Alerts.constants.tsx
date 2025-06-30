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

import { filter, startCase } from 'lodash';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../generated/events/eventSubscription';
import { getAlertDestinationCategoryIcons } from '../utils/ObservabilityUtils';

export const DESTINATION_DROPDOWN_TABS = {
  internal: 'internal',
  external: 'external',
};

export const INTERNAL_CATEGORY_OPTIONS = filter(
  SubscriptionCategory,
  (value) => value !== SubscriptionCategory.External
).map((value) => ({
  label: (
    <div
      className="d-flex items-center gap-2"
      data-testid={`${startCase(value)}-internal-option`}>
      {getAlertDestinationCategoryIcons(value)}
      <span>{startCase(value)}</span>
    </div>
  ),
  value: startCase(value),
}));

export const EXTERNAL_CATEGORY_OPTIONS = filter(
  SubscriptionType,
  (value) =>
    // Exclude the following categories from the external dropdown
    value !== SubscriptionType.ActivityFeed &&
    value !== SubscriptionType.GovernanceWorkflowChangeEvent
).map((value) => ({
  label: (
    <div
      className="d-flex items-center gap-2"
      data-testid={`${startCase(value)}-external-option`}>
      {getAlertDestinationCategoryIcons(value)}
      <span>{startCase(value)}</span>
    </div>
  ),
  value: String(value),
}));

export const DESTINATION_SOURCE_ITEMS = {
  [DESTINATION_DROPDOWN_TABS.internal]: INTERNAL_CATEGORY_OPTIONS,
  [DESTINATION_DROPDOWN_TABS.external]: EXTERNAL_CATEGORY_OPTIONS,
};

export const DESTINATION_TYPE_BASED_PLACEHOLDERS = {
  [SubscriptionType.Slack]:
    'https://hooks.slack.com/services/XXXXX/XXXXX/XXXXX',
  [SubscriptionType.MSTeams]:
    'https://outlook.office.com/webhook/XXXXX/XXXXX/XXXXX',
  [SubscriptionType.GChat]:
    'https://chat.googleapis.com/v1/spaces/XXXXX/messages?key=XXXXX',
  [SubscriptionType.Webhook]: 'https://example.com',
  [SubscriptionType.Email]: 'Add ↵ separated Email addresses',
};

export const DEFAULT_READ_TIMEOUT = 12;
