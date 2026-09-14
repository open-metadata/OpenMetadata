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

import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import { PermissionDebugger as AccessControlIcon } from '@openmetadata/ui-core-components/icons';
import { Key01, Settings02, ShieldTick, User01 } from '@untitledui/icons';
import type { Key } from 'react';
import React, { FC } from 'react';
import { User } from '../../../../generated/entity/teams/user';
import AccessTokenPanel from './components/AccessTokenPanel';
import CustomPropertiesPanel from './panels/CustomPropertiesPanel/CustomPropertiesPanel';
import ProfileDetailsPanel from './ProfileDetailsPanel';
import AccessControlPanel from './tabs/access-control/AccessControlPanel';
import PermissionsTab from './tabs/PermissionsTab';

export type ProfileNavId =
  | 'profile'
  | 'permissions'
  | 'access-token'
  | 'my-connections'
  | 'access-control'
  | 'custom-properties';

/** The sidebar groups. Each maps to an uppercase header + breadcrumb root. */
export type ProfileNavGroup =
  | 'account'
  | 'administration'
  | 'workspace'
  | 'credentials';

/** Translation key for each group's sidebar header + breadcrumb root. */
export const PROFILE_NAV_GROUP_LABEL: Record<ProfileNavGroup, string> = {
  account: 'label.account',
  administration: 'label.administration',
  workspace: 'label.workspace',
  credentials: 'label.credential-plural',
};

/** Group render order in the sidebar. */
export const PROFILE_NAV_GROUP_ORDER: ProfileNavGroup[] = [
  'account',
  'administration',
  'workspace',
  'credentials',
];

/**
 * Dynamic overrides a panel can push up to ProfilePage so ProfileContentHeader
 * can reflect the panel's internal state (e.g. multi-level breadcrumbs, entity icon).
 * All fields are optional — panels provide only what they need to override.
 */
export interface ProfileHeaderOverride {
  breadcrumbs?: BreadcrumbItemType[];
  title?: string;
  description?: string;
  icon?: FC<{ className?: string }>;
  /** Pre-rendered icon node; takes precedence over `icon` in ProfileContentHeader. */
  iconNode?: React.ReactNode;
  onBreadcrumbAction?: (id: Key) => void;
  /** Action buttons rendered on the right of the header title row. */
  actions?: React.ReactNode;
  /** When set, renders in place of the title text (e.g. an inline rename input). */
  titleInput?: React.ReactNode;
  /** Node rendered inline right after the title text (e.g. a rename/edit icon button). */
  titleSuffix?: React.ReactNode;
}

/**
 * Context handed to each nav item's `render`. Mirrors the data ProfilePage
 * already fetches so the individual row / tab components keep their existing
 * props.
 */
export interface ProfileNavRenderContext {
  userData: User;
  isProfileLoading: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
  /** Allows a panel to override the header breadcrumbs/title shown by ProfilePage. */
  onHeaderChange?: (override: ProfileHeaderOverride | null) => void;
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
  /**
   * When true, ProfilePage skips the standard content scroll wrapper
   * (`overflow-y-auto p-8`) and lets the panel manage its own layout.
   * The header is still rendered by ProfilePage.
   */
  selfContainedLayout?: boolean;
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
  {
    id: 'access-control',
    group: 'administration',
    label: 'label.access-control',
    description: 'message.access-control-description',
    icon: AccessControlIcon,
    selfContainedLayout: true,
    render: ({ onHeaderChange }) => (
      <AccessControlPanel onHeaderChange={onHeaderChange} />
    ),
  },
  // The "My Connections" tab is contributed by the Query Runner plugin through
  // the `profile.tabs` extension point (see ProfilePage), so the app-mode
  // profile works standalone in OSS when the plugin is absent.
];

export const WORKSPACE_NAV_ITEMS: ProfileNavItem[] = [
  {
    id: 'custom-properties',
    group: 'workspace',
    label: 'label.custom-property-plural',
    description: 'message.custom-properties-settings-description',
    icon: Settings02 as FC<{ className?: string }>,
    selfContainedLayout: true,
    render: ({ onHeaderChange }) => (
      <CustomPropertiesPanel onHeaderChange={onHeaderChange} />
    ),
  },
];

export const getProfileNavItem = (id: ProfileNavId): ProfileNavItem =>
  PROFILE_NAV_ITEMS.find((item) => item.id === id) ?? PROFILE_NAV_ITEMS[0];
