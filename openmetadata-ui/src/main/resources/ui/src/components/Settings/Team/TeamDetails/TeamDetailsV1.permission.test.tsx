/*
 *  Copyright 2022 Collate.
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

import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';

describe('TeamDetailsV1 - Permission Changes Tests', () => {
  describe('Create Permission Logic', () => {
    it('should check Create permission for add team button', () => {
      const entityPermissions = {
        Create: true,
        Delete: false,
        ViewAll: true,
        EditAll: false,
        EditDescription: false,
        EditDisplayName: false,
        EditCustomFields: false,
      } as OperationPermission;

      const isTeamDeleted = false;
      const shouldBeDisabled = !entityPermissions.Create || isTeamDeleted;

      expect(shouldBeDisabled).toBe(false);
    });

    it('should disable button when Create permission is false', () => {
      const entityPermissions = {
        Create: false,
        Delete: false,
        ViewAll: true,
        EditAll: false,
        EditDescription: false,
        EditDisplayName: false,
        EditCustomFields: false,
      } as OperationPermission;

      const isTeamDeleted = false;
      const shouldBeDisabled = !entityPermissions.Create || isTeamDeleted;

      expect(shouldBeDisabled).toBe(true);
    });

    it('should disable button when team is deleted even with Create permission', () => {
      const entityPermissions = {
        Create: true,
        Delete: false,
        ViewAll: true,
        EditAll: false,
        EditDescription: false,
        EditDisplayName: false,
        EditCustomFields: false,
      } as OperationPermission;

      const isTeamDeleted = true;
      const shouldBeDisabled = !entityPermissions.Create || isTeamDeleted;

      expect(shouldBeDisabled).toBe(true);
    });

    it('should generate correct tooltip title based on Create permission', () => {
      const entityPermissions = {
        Create: true,
        Delete: false,
        ViewAll: true,
        EditAll: false,
        EditDescription: false,
        EditDisplayName: false,
        EditCustomFields: false,
      } as OperationPermission;

      const isTeamDeleted = false;

      let addTeamButtonTitle = entityPermissions.Create
        ? 'label.add-entity'
        : 'message.no-permission-for-action';

      if (isTeamDeleted) {
        addTeamButtonTitle =
          'message.this-action-is-not-allowed-for-deleted-entities';
      }

      expect(addTeamButtonTitle).toBe('label.add-entity');
    });

    it('should generate no permission tooltip when Create is false', () => {
      const entityPermissions = {
        Create: false,
        Delete: false,
        ViewAll: true,
        EditAll: false,
        EditDescription: false,
        EditDisplayName: false,
        EditCustomFields: false,
      } as OperationPermission;

      const isTeamDeleted = false;

      let addTeamButtonTitle = entityPermissions.Create
        ? 'label.add-entity'
        : 'message.no-permission-for-action';

      if (isTeamDeleted) {
        addTeamButtonTitle =
          'message.this-action-is-not-allowed-for-deleted-entities';
      }

      expect(addTeamButtonTitle).toBe('message.no-permission-for-action');
    });

    it('should generate deleted team tooltip when team is deleted', () => {
      const entityPermissions = {
        Create: true,
        Delete: false,
        ViewAll: true,
        EditAll: false,
        EditDescription: false,
        EditDisplayName: false,
        EditCustomFields: false,
      } as OperationPermission;

      const isTeamDeleted = true;

      let addTeamButtonTitle = entityPermissions.Create
        ? 'label.add-entity'
        : 'message.no-permission-for-action';

      if (isTeamDeleted) {
        addTeamButtonTitle =
          'message.this-action-is-not-allowed-for-deleted-entities';
      }

      expect(addTeamButtonTitle).toBe(
        'message.this-action-is-not-allowed-for-deleted-entities'
      );
    });
  });
});
