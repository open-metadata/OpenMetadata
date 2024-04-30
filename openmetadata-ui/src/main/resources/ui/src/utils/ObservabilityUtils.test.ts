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
import { SubscriptionCategory } from '../generated/events/eventSubscription';
import {
  checkIfDestinationIsInternal,
  getAlertDestinationCategoryIcons,
  getConfigFieldFromDestinationType,
} from './ObservabilityUtils';

describe('Observability Utils test', () => {
  describe('getAlertDestinationCategoryIcons', () => {
    it('should return the correct icon for each type', () => {
      const types = [
        'Teams',
        'Users',
        'Admins',
        'GChat',
        'Slack',
        'Email',
        'MsTeams',
        'Followers',
        'Webhook',
        'Owners',
      ];
      types.forEach((type) => {
        const icon = getAlertDestinationCategoryIcons(type);

        expect(icon).not.toBeNull();
      });
    });

    it('should return null for an unknown type', () => {
      const icon = getAlertDestinationCategoryIcons('Unknown');

      expect(icon).toBeNull();
    });
  });

  describe('checkIfDestinationIsInternal', () => {
    it('should return true for internal destinations', () => {
      const destinationName = SubscriptionCategory.Admins;
      const result = checkIfDestinationIsInternal(destinationName);

      expect(result).toBe(true);
    });

    it('should return false for external destinations', () => {
      const destinationName = 'Test';
      const result = checkIfDestinationIsInternal(destinationName);

      expect(result).toBe(false);
    });
  });

  describe('getConfigFieldFromDestinationType', () => {
    it('should return the correct config field for each type', () => {
      const types = [
        SubscriptionCategory.Admins,
        SubscriptionCategory.Owners,
        SubscriptionCategory.Followers,
      ];
      const expectedResults = [
        'sendToAdmins',
        'sendToOwners',
        'sendToFollowers',
      ];
      types.forEach((type, index) => {
        const result = getConfigFieldFromDestinationType(type);

        expect(result).toBe(expectedResults[index]);
      });
    });

    it('should return an empty string for an unknown type', () => {
      const result = getConfigFieldFromDestinationType('Unknown');

      expect(result).toBe('');
    });
  });
});
