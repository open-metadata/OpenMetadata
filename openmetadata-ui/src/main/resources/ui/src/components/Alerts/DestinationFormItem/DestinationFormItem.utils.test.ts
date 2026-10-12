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

import type { Destination } from '../../../generated/events/eventSubscription';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import {
  getTestableExternalDestinations,
  hasExternalDestination,
} from './DestinationFormItem.utils';

describe('DestinationFormItem utilities', () => {
  it('recognizes only supported external destination types', () => {
    const destinations = [
      {
        category: SubscriptionCategory.External,
        destinationType: SubscriptionType.Slack,
        type: SubscriptionType.Slack,
      },
    ] as Destination[];

    expect(hasExternalDestination(destinations)).toBe(true);
    expect(
      hasExternalDestination([
        {
          category: SubscriptionCategory.Owners,
          destinationType: SubscriptionCategory.Owners,
          type: SubscriptionType.Email,
        },
      ] as Destination[])
    ).toBe(false);
  });

  it('returns only configured external destinations for connection testing', () => {
    const configuredExternal = {
      category: SubscriptionCategory.External,
      type: SubscriptionType.Slack,
      config: { endpoint: 'https://hooks.slack.com' },
    } as Destination;
    const destinations = [
      configuredExternal,
      {
        category: SubscriptionCategory.External,
        type: SubscriptionType.Webhook,
        config: {},
      },
      {
        category: SubscriptionCategory.Owners,
        type: SubscriptionType.Email,
        config: { receivers: ['owner@example.com'] },
      },
    ] as Destination[];

    expect(getTestableExternalDestinations(destinations)).toEqual([
      configuredExternal,
    ]);
  });
});
