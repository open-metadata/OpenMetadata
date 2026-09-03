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
import { getFilteredDestinationOptions } from '../../../../utils/Alerts/AlertsUtilPure';
import { getAlertDestinationCategoryIcons } from '../../../../utils/ObservabilityUtils';
import { buildGroupedOptions } from './DestinationSelectItem.utils';

jest.mock('../../../../utils/Alerts/AlertsUtilPure', () => ({
  getFilteredDestinationOptions: jest
    .fn()
    .mockImplementation((key: string) =>
      key === 'internal'
        ? [{ value: SubscriptionCategory.Admins }]
        : [{ value: SubscriptionType.Slack }, { value: SubscriptionType.GChat }]
    ),
}));

jest.mock('../../../../utils/ObservabilityUtils', () => ({
  getAlertDestinationCategoryIcons: jest.fn().mockReturnValue(null),
}));

describe('DestinationSelectItem utilities', () => {
  it('builds labeled internal and external option groups for the source', () => {
    const options = buildGroupedOptions('Internal', 'External', 'table');

    expect(getFilteredDestinationOptions).toHaveBeenNthCalledWith(
      1,
      'internal',
      'table'
    );
    expect(getFilteredDestinationOptions).toHaveBeenNthCalledWith(
      2,
      'external',
      'table'
    );
    expect(getAlertDestinationCategoryIcons).toHaveBeenCalledWith(
      SubscriptionCategory.Admins
    );
    expect(getAlertDestinationCategoryIcons).toHaveBeenCalledWith(
      SubscriptionType.Slack
    );
    expect(options).toEqual([
      { id: 'header-internal', label: 'Internal', isDisabled: true },
      {
        id: SubscriptionCategory.Admins,
        label: 'Admins',
        icon: null,
      },
      { id: 'header-external', label: 'External', isDisabled: true },
      { id: SubscriptionType.Slack, label: 'Slack', icon: null },
      { id: SubscriptionType.GChat, label: 'G Chat', icon: null },
    ]);
  });
});
