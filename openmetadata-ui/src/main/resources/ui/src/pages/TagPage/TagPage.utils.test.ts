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

import type { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import type { Tag } from '../../generated/entity/classification/tag';
import { getDerivedPermissionFlags } from '../../utils/PermissionDerivation';
import { getTagPagePermissions } from './TagPage.utils';

const PERMISSIONS = {
  EditAll: true,
  EditOwners: true,
  EditDomains: true,
} as unknown as OperationPermission;

const tag = (overrides: Partial<Tag> = {}) =>
  ({ name: 'NonSensitive', ...overrides } as Tag);

const flagsFor = (t: Tag) =>
  getDerivedPermissionFlags(
    getTagPagePermissions(t, PERMISSIONS, true).disabledAwarePermissions,
    false
  );

describe('getTagPagePermissions', () => {
  it('keeps owner and domain editing on an enabled tag', () => {
    const flags = flagsFor(tag());

    expect(flags.canEditOwners).toBe(true);
    expect(flags.canEditDomains).toBe(true);
  });

  it.each([
    ['disabled', { disabled: true }],
    ['deleted', { deleted: true }],
  ])(
    'blocks owner and domain editing on a %s tag even with explicit keys',
    (_, overrides) => {
      const flags = flagsFor(tag(overrides));

      expect(flags.canEditOwners).toBe(false);
      expect(flags.canEditDomains).toBe(false);
      expect(
        getTagPagePermissions(tag(overrides), PERMISSIONS, true)
          .editTagsPermission
      ).toBe(false);
    }
  );

  it('passes permissions through before the tag has loaded', () => {
    expect(getTagPagePermissions(undefined, PERMISSIONS, true)).toEqual({
      editTagsPermission: false,
      disabledAwarePermissions: PERMISSIONS,
    });
  });
});
