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

import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../../../generated/events/eventSubscription';
import { buildGroupedOptions } from './DestinationSelectItem.utils';

jest.mock('../../../../utils/ObservabilityUtils', () => ({
  getAlertDestinationCategoryIcons: jest.fn().mockReturnValue(null),
}));

const internalIds = (options: { id: string }[]) =>
  options
    .slice(
      1,
      options.findIndex(({ id }) => id === 'header-external')
    )
    .map(({ id }) => id);

describe('DestinationSelectItem utilities', () => {
  it('offers the recipients inside the platform the server offers, and every channel', () => {
    const options = buildGroupedOptions('Internal', 'External', [
      SubscriptionCategory.Owners,
      SubscriptionCategory.Mentions,
    ]);

    expect(options[0]).toEqual({
      id: 'header-internal',
      label: 'Internal',
      isDisabled: true,
    });
    expect(internalIds(options)).toEqual([
      SubscriptionCategory.Mentions,
      SubscriptionCategory.Owners,
    ]);
    expect(options.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'header-external',
        SubscriptionType.Slack,
        SubscriptionType.Webhook,
        SubscriptionType.Email,
      ])
    );
  });

  // An alert saved with a recipient its sources no longer offer must still open and save.
  it('keeps the recipient a destination already has', () => {
    const options = buildGroupedOptions(
      'Internal',
      'External',
      [SubscriptionCategory.Owners],
      SubscriptionCategory.Followers
    );

    expect(internalIds(options)).toEqual([
      SubscriptionCategory.Followers,
      SubscriptionCategory.Owners,
    ]);
  });

  it('offers only the current recipient until the server has answered', () => {
    expect(
      internalIds(
        buildGroupedOptions(
          'Internal',
          'External',
          undefined,
          SubscriptionCategory.Admins
        )
      )
    ).toEqual([SubscriptionCategory.Admins]);
    expect(internalIds(buildGroupedOptions('Internal', 'External'))).toEqual(
      []
    );
  });
});
