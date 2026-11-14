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

import { useMemo } from 'react';
import { ResourceEntity } from '../../../../../../enums/permissions.enum';
import { User } from '../../../../../../generated/entity/teams/user';
import { useAuth } from '../../../../../../hooks/authHooks';
import { useUserCustomPropertyAccess } from '../../../../../../hooks/discovery/personal-space/useUserCustomPropertyAccess';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import { useEntityPermissions } from '../../../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getDerivedPermissionFlags } from '../../../../../../utils/PermissionDerivation';
import type { MembersUserDetailView, UserDetailTab } from './Members.types';
import { getHiddenUserDetailTabs } from './Members.utils';

/**
 * What the viewer may do on a user's detail, and which tabs it shows. Gating
 * mirrors the user PATCH endpoint: editing needs EditAll on the user, roles
 * stay admin-only (their rows' default), and a deleted user is read-only apart
 * from restore.
 */
export const useMembersUserDetailAccess = (
  view: MembersUserDetailView,
  user?: User
) => {
  const { isAdminUser } = useAuth();
  const { currentUser } = useApplicationStore();
  const { permissions, hasViewAccess, canEditAll, canDelete, isLoading } =
    useEntityPermissions(ResourceEntity.USER, view.name, {
      deleted: user?.deleted,
      enabled: Boolean(user),
    });
  // Restore must stay reachable on a deleted user, whose edit flags are off.
  const canRestore = useMemo(
    () => getDerivedPermissionFlags(permissions, false).canEditAll,
    [permissions]
  );
  const customPropertyAccess = useUserCustomPropertyAccess(user);
  // The permission debug info behind Access is admin-only for anyone else.
  const canViewAccess = Boolean(isAdminUser) || view.name === currentUser?.name;
  // Keep a deep-linked Custom Properties tab listed while its access resolves;
  // dropping it would let the tab strip reselect Overview and rewrite the hash.
  const isTabPending =
    view.tab === 'custom-properties' && customPropertyAccess.isLoading;
  const hiddenTabs = useMemo(
    () =>
      getHiddenUserDetailTabs({
        isBot: user?.isBot,
        canViewAccess,
        canViewCustomProperties: customPropertyAccess.canView || isTabPending,
      }),
    [user?.isBot, canViewAccess, customPropertyAccess.canView, isTabPending]
  );
  const activeTab: UserDetailTab = hiddenTabs.has(view.tab)
    ? 'overview'
    : view.tab;

  return {
    canEditAll,
    canDelete,
    canRestore,
    isNoAccess: Boolean(user) && !isLoading && !hasViewAccess,
    hiddenTabs,
    activeTab,
  };
};
