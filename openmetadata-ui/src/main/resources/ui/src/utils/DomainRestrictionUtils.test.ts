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
import { DOMAIN_ONLY_ACCESS_ROLE } from '../constants/constants';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/entity/type';
import {
  filterDomainsToAllowed,
  getUserDomainOptions,
  isDomainRestrictedUser,
} from './DomainRestrictionUtils';

const restrictedRole: EntityReference = {
  id: 'role-1',
  type: 'role',
  name: DOMAIN_ONLY_ACCESS_ROLE,
};

const otherRole: EntityReference = {
  id: 'role-2',
  type: 'role',
  name: 'DataConsumer',
};

const baseUser: User = {
  id: 'user-1',
  name: 'test-user',
  email: 'test@example.com',
};

describe('DomainRestrictionUtils', () => {
  describe('isDomainRestrictedUser', () => {
    it('should return false when user is undefined', () => {
      expect(isDomainRestrictedUser(undefined)).toBe(false);
    });

    it('should return false for an admin even when they hold the role', () => {
      expect(
        isDomainRestrictedUser({
          ...baseUser,
          isAdmin: true,
          roles: [restrictedRole],
        })
      ).toBe(false);
    });

    it('should return true when role is in direct roles', () => {
      expect(
        isDomainRestrictedUser({
          ...baseUser,
          roles: [otherRole, restrictedRole],
        })
      ).toBe(true);
    });

    it('should return true when role is in inherited roles', () => {
      expect(
        isDomainRestrictedUser({
          ...baseUser,
          inheritedRoles: [restrictedRole],
        })
      ).toBe(true);
    });

    it('should return false for a normal user without the role', () => {
      expect(
        isDomainRestrictedUser({
          ...baseUser,
          roles: [otherRole],
        })
      ).toBe(false);
    });
  });

  describe('getUserDomainOptions', () => {
    it('should return empty array when user is undefined', () => {
      expect(getUserDomainOptions(undefined)).toEqual([]);
    });

    it('should return empty array when user has no domains', () => {
      expect(getUserDomainOptions(baseUser)).toEqual([]);
    });

    it('should return the user domains', () => {
      const domains: EntityReference[] = [
        { id: 'd1', type: 'domain', fullyQualifiedName: 'Engineering' },
      ];

      expect(getUserDomainOptions({ ...baseUser, domains })).toEqual(domains);
    });
  });

  describe('filterDomainsToAllowed', () => {
    const domains = [
      { fullyQualifiedName: 'Engineering' },
      { fullyQualifiedName: 'Engineering.Backend' },
      { fullyQualifiedName: 'Marketing' },
    ];

    it('should return empty array when allowed list is empty', () => {
      expect(filterDomainsToAllowed(domains, [])).toEqual([]);
    });

    it('should keep exact and descendant matches and drop foreign domains', () => {
      const allowed: EntityReference[] = [
        { id: 'd1', type: 'domain', fullyQualifiedName: 'Engineering' },
      ];

      expect(filterDomainsToAllowed(domains, allowed)).toEqual([
        { fullyQualifiedName: 'Engineering' },
        { fullyQualifiedName: 'Engineering.Backend' },
      ]);
    });

    it('should not treat a sibling prefix as a descendant', () => {
      const allowed: EntityReference[] = [
        { id: 'd1', type: 'domain', fullyQualifiedName: 'Eng' },
      ];

      expect(filterDomainsToAllowed(domains, allowed)).toEqual([]);
    });

    it('should drop domains without a fullyQualifiedName', () => {
      const allowed: EntityReference[] = [
        { id: 'd1', type: 'domain', fullyQualifiedName: 'Engineering' },
      ];

      expect(
        filterDomainsToAllowed([{ fullyQualifiedName: undefined }], allowed)
      ).toEqual([]);
    });
  });
});
