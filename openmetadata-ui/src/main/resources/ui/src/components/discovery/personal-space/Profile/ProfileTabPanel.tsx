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

import { User01 } from '@openmetadata/ui-core-components/icons';
import type { Key } from 'react';
import { FC, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../../hooks/authHooks';
import { useSettingsHash } from '../../../../hooks/useSettingsHash';
import ProfileDetailsPanel from './ProfileDetailsPanel';
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
  profileSubPathToUserView,
  USER_DETAIL_BACK_TO_USERS,
  userViewToProfileSubPath,
  viewToSubPath,
} from './tabs/members/Members.utils';
import MembersUserDetail from './tabs/members/MembersUserDetail';
import { buildUserIdentityHeader } from './tabs/members/useMembersUserDetailHeader';

const SCROLL_BODY_CLASS =
  'tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0';

/** Your own Profile tab: the identity header, then the panel. */
const OwnProfile: FC<ProfileNavRenderContext> = ({
  userData,
  isProfileLoading,
  updateUserDetails,
  onHeaderChange,
}) => {
  const { t } = useTranslation();
  useEffect(() => {
    onHeaderChange?.(buildUserIdentityHeader(t, userData, true));
  }, [onHeaderChange, t, userData]);

  useEffect(() => () => onHeaderChange?.(null), [onHeaderChange]);

  return (
    <div className={SCROLL_BODY_CLASS} data-testid="profile-content-body">
      <ProfileDetailsPanel
        showCustomProperties
        isProfileLoading={isProfileLoading}
        updateUserDetails={updateUserDetails}
        userData={userData}
      />
    </div>
  );
};

interface OtherUserProfileProps {
  view: MembersUserDetailView;
  onHeaderChange?: ProfileNavRenderContext['onHeaderChange'];
}

/**
 * Another user opened from the Profile route (`#profile/<name>`), so non-admins
 * get the read-only user detail. Settings › Members › Users are admin-only
 * destinations, so those crumbs only navigate for admins (prototype behaviour).
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
    <div className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-y-auto">
      <MembersUserDetail
        view={view}
        onNavigate={onNavigate}
        onSetHeader={handleSetHeader}
      />
    </div>
  );
};

/**
 * The `profile` nav item: your own profile, or — when the hash names someone
 * else — that user's read-only detail with the same tabs as Members.
 */
const ProfileTabPanel: FC<ProfileNavRenderContext> = (props) => {
  const { state } = useSettingsHash();
  const { userData, onHeaderChange } = props;

  const otherView = useMemo(() => {
    const view =
      state.tab === 'profile'
        ? profileSubPathToUserView(state.subPath)
        : undefined;

    return view && view.name !== userData.name ? view : undefined;
  }, [state.tab, state.subPath, userData.name]);

  if (otherView) {
    return (
      <OtherUserProfile
        key={otherView.name}
        view={otherView}
        onHeaderChange={onHeaderChange}
      />
    );
  }

  return <OwnProfile {...props} />;
};

export default ProfileTabPanel;
