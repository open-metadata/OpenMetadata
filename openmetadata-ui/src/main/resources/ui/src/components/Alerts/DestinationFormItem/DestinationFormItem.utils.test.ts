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
  Status,
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import {
  alignDestinationsWithTestStatus,
  getTestableExternalDestinations,
  hasExternalDestination,
  isTestableExternalDestination,
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

  describe('isTestableExternalDestination', () => {
    it('is true only for external destinations with a non-empty config', () => {
      expect(
        isTestableExternalDestination({
          category: SubscriptionCategory.External,
          type: SubscriptionType.Slack,
          config: { endpoint: 'https://hooks.slack.com' },
        } as Destination)
      ).toBe(true);
      expect(
        isTestableExternalDestination({
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
          config: {},
        } as Destination)
      ).toBe(false);
      expect(
        isTestableExternalDestination({
          category: SubscriptionCategory.External,
          type: SubscriptionType.Slack,
        } as Destination)
      ).toBe(false);
      expect(
        isTestableExternalDestination({
          category: SubscriptionCategory.Owners,
          type: SubscriptionType.Email,
          config: { receivers: ['owner@example.com'] },
        } as Destination)
      ).toBe(false);
    });
  });

  describe('alignDestinationsWithTestStatus', () => {
    const slackExternal = {
      category: SubscriptionCategory.External,
      type: SubscriptionType.Slack,
      config: { endpoint: 'https://hooks.slack.com' },
    } as Destination;
    const ownersInternal = {
      category: SubscriptionCategory.Owners,
      type: SubscriptionType.Email,
      config: { receivers: ['owner@example.com'] },
    } as Destination;
    const emptyExternal = {
      category: SubscriptionCategory.External,
      type: SubscriptionType.Webhook,
      config: {},
    } as Destination;

    it('places each tested row status at its form index and undefined for non-tested rows', () => {
      const testedWithStatus = [
        {
          ...slackExternal,
          statusDetails: { status: Status.Success, statusCode: 200 },
        },
      ];

      const aligned = alignDestinationsWithTestStatus(
        [ownersInternal, slackExternal, emptyExternal],
        testedWithStatus
      );

      expect(aligned).toHaveLength(3);
      expect(aligned[0]).toBeUndefined();
      expect(aligned[1]?.statusDetails).toEqual({
        status: Status.Success,
        statusCode: 200,
      });
      expect(aligned[2]).toBeUndefined();
    });

    it('keeps duplicate tested destinations as distinct entries at their own indices', () => {
      const testedWithStatus = [
        {
          ...slackExternal,
          statusDetails: { status: Status.Success, statusCode: 200 },
        },
        {
          ...slackExternal,
          statusDetails: { status: Status.Failed, statusCode: 500 },
        },
      ];

      const aligned = alignDestinationsWithTestStatus(
        [slackExternal, slackExternal],
        testedWithStatus
      );

      expect(aligned).toHaveLength(2);
      expect(aligned[0]?.statusDetails?.status).toBe(Status.Success);
      expect(aligned[1]?.statusDetails?.status).toBe(Status.Failed);
    });

    it('returns undefined for every row when nothing was tested', () => {
      const aligned = alignDestinationsWithTestStatus(
        [ownersInternal, slackExternal],
        []
      );

      expect(aligned).toHaveLength(2);
      expect(aligned[0]).toBeUndefined();
      expect(aligned[1]).toBeUndefined();
    });
  });
});
