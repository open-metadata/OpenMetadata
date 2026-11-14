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

import { Box } from '@openmetadata/ui-core-components';
import { User01 } from '@openmetadata/ui-core-components/icons';
import type { Key } from 'react';
import { FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../../hooks/authHooks';
import { useSettingsHash } from '../../../../hooks/useSettingsHash';
import type {
  ProfileHeaderOverride,
  ProfileNavRenderContext,
} from './profileNavConfig';
import type {
  MembersUserDetailView,
  MembersView,
} from './tabs/members/Members.types';
import {
  buildMembersHeaderMaps,
  makeBreadcrumbAction,
  USER_DETAIL_BACK_TO_USERS,
} from './tabs/members/Members.utils';
import {
  userViewToProfileSubPath,
  viewToSubPath,
} from './tabs/members/membersRoute.utils';
import MembersUserDetail from './tabs/members/MembersUserDetail';

interface OtherUserProfileProps {
  view: MembersUserDetailView;
  onHeaderChange?: ProfileNavRenderContext['onHeaderChange'];
}

/**
 * Another user opened from the Profile route (`#profile/<name>`), so non-admins
 * get the user detail. Settings › Members › Users are admin-only destinations,
 * so those crumbs only navigate for admins.
 */
const OtherUserProfile: FC<OtherUserProfileProps> = ({
  view,
  onHeaderChange,
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { setHash } = useSettingsHash();

  const onNavigate = useCallback(
    (next: MembersView) =>
      next.type === 'user-detail'
        ? setHash('profile', userViewToProfileSubPath(next))
        : setHash('members', viewToSubPath(next)),
    [setHash]
  );

  const onBreadcrumbAction = useMemo(() => {
    if (!isAdminUser && !view.taskId) {
      return undefined;
    }
    const navigate = makeBreadcrumbAction(onNavigate, view);

    return (id: Key) => {
      if (isAdminUser || !USER_DETAIL_BACK_TO_USERS.has(id)) {
        navigate(id);
      }
    };
  }, [isAdminUser, onNavigate, view]);

  const handleSetHeader = useCallback(
    (header?: Partial<ProfileHeaderOverride>) =>
      onHeaderChange?.(
        header
          ? {
              icon: User01,
              breadcrumbs: buildMembersHeaderMaps(view, t, '').crumbsByType[
                'user-detail'
              ],
              onBreadcrumbAction,
              ...header,
            }
          : null
      ),
    [onBreadcrumbAction, onHeaderChange, t, view]
  );

  return (
    <Box className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto" direction="col">
      <MembersUserDetail
        view={view}
        onNavigate={onNavigate}
        onSetHeader={handleSetHeader}
      />
    </Box>
  );
};

export default OtherUserProfile;
