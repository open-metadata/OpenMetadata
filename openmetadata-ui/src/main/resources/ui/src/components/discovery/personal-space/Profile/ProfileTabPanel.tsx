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

import { FC, useMemo } from 'react';
import { useSettingsHash } from '../../../../hooks/useSettingsHash';
import OtherUserProfile from './OtherUserProfile';
import OwnProfile from './OwnProfile';
import type { ProfileNavRenderContext } from './profileNavConfig';
import { getProfileUserDetailView } from './tabs/members/membersRoute.utils';

/**
 * The `profile` nav item: your own profile, or — when the hash names someone
 * else, or a tab or task of yours — that user's detail with the same tabs as
 * Members.
 */
const ProfileTabPanel: FC<ProfileNavRenderContext> = (props) => {
  const { state } = useSettingsHash();
  const { userData, onHeaderChange } = props;

  const otherView = useMemo(
    () =>
      state.tab === 'profile'
        ? getProfileUserDetailView(state.subPath, userData.name)
        : undefined,
    [state.tab, state.subPath, userData.name]
  );

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
