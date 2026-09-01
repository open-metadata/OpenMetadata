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

import { EntityReference } from 'generated/entity/type';

jest.mock('utils/EntityLinkUtils', () => ({
  getEntityLinkFromType: (fqn: string, type: string) =>
    type === 'table' ? '' : `/${type}/${fqn}`,
}));

import {
  getEffectBadgeColor,
  getPermissionEntityLink,
} from './permissions.utils';

const ref = (type: string, fqn?: string): EntityReference =>
  ({ type, fullyQualifiedName: fqn } as EntityReference);

describe('permissions.utils', () => {
  describe('getEffectBadgeColor', () => {
    it('returns success for ALLOW (any case)', () => {
      expect(getEffectBadgeColor('ALLOW')).toBe('success');
      expect(getEffectBadgeColor('allow')).toBe('success');
    });

    it('returns error for Deny or missing effect', () => {
      expect(getEffectBadgeColor('DENY')).toBe('error');
      expect(getEffectBadgeColor('')).toBe('error');
    });
  });

  describe('getPermissionEntityLink', () => {
    it('routes by entity type using the fully qualified name', () => {
      expect(getPermissionEntityLink(ref('policy', 'p1'))).toBe('/policy/p1');
      expect(getPermissionEntityLink(ref('role', 'r1'))).toBe('/role/r1');
      expect(getPermissionEntityLink(ref('team', 't1'))).toBe('/team/t1');
    });

    it('routes domain and other resolvable source types', () => {
      expect(getPermissionEntityLink(ref('domain', 'sales_domain'))).toBe(
        '/domain/sales_domain'
      );
      expect(getPermissionEntityLink(ref('persona', 'ps1'))).toBe(
        '/persona/ps1'
      );
    });

    it('falls back to name when fqn is absent', () => {
      expect(
        getPermissionEntityLink({
          type: 'role',
          name: 'admin',
        } as EntityReference)
      ).toBe('/role/admin');
    });

    it('returns # for a type the resolver cannot handle', () => {
      expect(getPermissionEntityLink(ref('table', 'x'))).toBe('#');
    });
  });
});
