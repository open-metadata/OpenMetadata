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

import { Key01, ShieldTick, User01 } from '@untitledui/icons';
import { User } from '../../../../generated/entity/teams/user';
import React, { FC } from 'react';
import ProfileDetailsPanel from './ProfileDetailsPanel';
import AccessTokenPanel from './components/AccessTokenPanel';
import PermissionsTab from './tabs/PermissionsTab';

export type ProfileNavId =
  | 'profile'
  | 'permissions'
  | 'access-token'
  | 'my-connections';

/** The two sidebar groups. Each maps to an uppercase header + breadcrumb root. */
export type ProfileNavGroup = 'account' | 'credentials';

/** Translation key for each group's sidebar header + breadcrumb root. */
export const PROFILE_NAV_GROUP_LABEL: Record<ProfileNavGroup, string> = {
  account: 'label.account',
  credentials: 'label.credential-plural',
};

/** Group render order in the sidebar. */
export const PROFILE_NAV_GROUP_ORDER: ProfileNavGroup[] = [
  'account',
  'credentials',
];

/**
 * Context handed to each nav item's `render`. Mirrors the data ProfilePage
 * already fetches so the individual row / tab components keep their existing
 * props.
 */
export interface ProfileNavRenderContext {
  userData: User;
  isProfileLoading: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

export interface ProfileNavItem {
  id: ProfileNavId;
  /** Sidebar group this item belongs to. */
  group: ProfileNavGroup;
  /** Translation key for the nav label + content-header title. */
  label: string;
  /** Translation key for the content-header description (per page). */
  description: string;
  icon: FC<{ className?: string }>;
  render: (ctx: ProfileNavRenderContext) => React.ReactNode;
}

export const DEFAULT_PROFILE_NAV_ID: ProfileNavId = 'profile';

export const PROFILE_NAV_ITEMS: ProfileNavItem[] = [
  {
    id: 'profile',
    group: 'account',
    label: 'label.profile',
    description: 'message.profile-page-description',
    icon: User01,
    render: ({ userData, isProfileLoading, updateUserDetails }) => (
      <ProfileDetailsPanel
        isProfileLoading={isProfileLoading}
        updateUserDetails={updateUserDetails}
        userData={userData}
      />
    ),
  },
  {
    id: 'permissions',
    group: 'account',
    label: 'label.permission-plural',
    description: 'message.permissions-page-description',
    icon: ShieldTick,
    render: ({ userData, updateUserDetails }) => (
      <PermissionsTab
        updateUserDetails={updateUserDetails}
        userData={userData}
      />
    ),
  },
  {
    id: 'access-token',
    group: 'credentials',
    label: 'label.access-token',
    description: 'message.access-token-page-description',
    icon: Key01,
    render: () => <AccessTokenPanel />,
  },
  // The "My Connections" tab is contributed by the Query Runner plugin through
  // the `profile.tabs` extension point (see ProfilePage), so the app-mode
  // profile works standalone in OSS when the plugin is absent.
];

export const getProfileNavItem = (id: ProfileNavId): ProfileNavItem =>
  PROFILE_NAV_ITEMS.find((item) => item.id === id) ?? PROFILE_NAV_ITEMS[0];
