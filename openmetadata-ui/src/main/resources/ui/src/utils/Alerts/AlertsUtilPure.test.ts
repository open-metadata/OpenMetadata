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

import {
  Destination,
  SubscriptionCategory,
  SubscriptionType,
} from '../../generated/events/eventSubscription';
import { Status } from '../../generated/events/testDestinationStatus';
import { getDestinationsWithTestStatus } from './AlertsUtilPure';

const webhookDestination = {
  category: SubscriptionCategory.External,
  type: SubscriptionType.Webhook,
  config: {
    endpoint: 'https://example.com/webhook',
    authType: { type: 'oauth2', clientSecret: 'super-secret' },
  },
} as unknown as Destination;

const slackDestination = {
  category: SubscriptionCategory.External,
  type: SubscriptionType.Slack,
  config: { endpoint: 'https://hooks.slack.com/services/xxx' },
} as unknown as Destination;

describe('getDestinationsWithTestStatus', () => {
  it('should keep the submitted config since the API redacts it from the response', () => {
    const redactedResults = [
      {
        category: SubscriptionCategory.External,
        type: SubscriptionType.Webhook,
        statusDetails: { status: Status.Success, statusCode: 200 },
      },
    ] as unknown as Destination[];

    const result = getDestinationsWithTestStatus(
      [webhookDestination],
      redactedResults
    );

    expect(result[0].config).toEqual(webhookDestination.config);
    expect(result[0].statusDetails).toEqual({
      status: Status.Success,
      statusCode: 200,
    });
  });

  it('should pair results with destinations positionally', () => {
    const redactedResults = [
      { statusDetails: { status: Status.Success } },
      {
        statusDetails: { status: Status.Failed, reason: 'Connection refused' },
      },
    ] as unknown as Destination[];

    const result = getDestinationsWithTestStatus(
      [webhookDestination, slackDestination],
      redactedResults
    );

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe(SubscriptionType.Webhook);
    expect(result[0].statusDetails).toEqual({ status: Status.Success });
    expect(result[1].type).toBe(SubscriptionType.Slack);
    expect(result[1].statusDetails).toEqual({
      status: Status.Failed,
      reason: 'Connection refused',
    });
  });

  it('should leave the status undefined when a result is missing', () => {
    const result = getDestinationsWithTestStatus(
      [webhookDestination, slackDestination],
      [] as Destination[]
    );

    expect(result).toHaveLength(2);
    expect(result[0].statusDetails).toBeUndefined();
    expect(result[1].config).toEqual(slackDestination.config);
  });
});
