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

import type { ProfileNavId } from '../../../../constants/Profile.constants';
import { UIPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { userPermissions } from '../../../../utils/PermissionsUtils';

export type ProfileNavVisibility = (
  permissions: UIPermission,
  isAdmin: boolean
) => boolean;

const adminOnly: ProfileNavVisibility = (_permissions, isAdmin) => isAdmin;
const canView =
  (resource: ResourceEntity): ProfileNavVisibility =>
  (permissions) =>
    userPermissions.hasViewPermissions(resource, permissions);

/**
 * Who may see each gated settings-modal tab. Kept apart from
 * `profileNavConfig` (which imports every panel) so the app-mode settings
 * redirect can apply the same rules without loading the panels.
 */
export const PROFILE_NAV_VISIBILITY: Partial<
  Record<ProfileNavId, ProfileNavVisibility>
> = {
  'access-control': adminOnly,
  bots: adminOnly,
  'platform-settings': adminOnly,
  sso: adminOnly,
  personas: adminOnly,
  members: adminOnly,
  'custom-properties': canView(ResourceEntity.TYPE),
  governance: adminOnly,
  applications: canView(ResourceEntity.APPLICATION),
  notification: canView(ResourceEntity.EVENT_SUBSCRIPTION),
};

/** Whether `tab` is visible for the user; ungated tabs always are. */
export const isProfileNavVisible = (
  tab: string,
  permissions: UIPermission,
  isAdmin: boolean
): boolean =>
  PROFILE_NAV_VISIBILITY[tab as ProfileNavId]?.(permissions, isAdmin) ?? true;
