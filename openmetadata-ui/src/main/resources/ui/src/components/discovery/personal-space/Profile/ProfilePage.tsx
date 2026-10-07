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

import { Box, EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { Link01, User01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy } from 'lodash';
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../../../components/common/Loader/Loader';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { User } from '../../../../generated/entity/teams/user';
import { Include } from '../../../../generated/type/include';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useSettingsHash } from '../../../../hooks/useSettingsHash';
import { getUserByName, updateUserDetail } from '../../../../rest/userAPI';
import {
  EXTENSION_POINTS,
  PluginEntityDetailsContext,
  TabContribution,
} from '../../../../utils/ExtensionPointTypes';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { useApplicationsProvider } from '../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import './profile-page.less';
import ProfileContentHeader from './ProfileContentHeader';
import {
  APPLICATION_NAV_ITEMS,
  DEFAULT_PROFILE_NAV_ID,
  FEATURES_NAV_ITEMS,
  ProfileHeaderOverride,
  ProfileNavGroup,
  ProfileNavId,
  ProfileNavItem,
  PROFILE_NAV_GROUP_LABEL,
  PROFILE_NAV_ITEMS,
  WORKSPACE_NAV_ITEMS,
} from './profileNavConfig';
import ProfileSideNav from './ProfileSideNav';
import { safeDecodeURIComponent } from './tabs/members/Members.utils';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { permissions } = usePermissionProvider();
  const { extensionRegistry } = useApplicationsProvider();
  // Seed userData from the application store so the page chrome renders
  // immediately on tab switch. The getUserByName fetch below refreshes
  // fields in the background.
  const [userData, setUserData] = useState<User | undefined>(
    currentUser as User | undefined
  );
  // The seeded currentUser lacks roles/teams/personas/domains; keep the
  // detail cards in a skeleton state until getUserByName backfills them so
  // the sections do not flash empty before the fetch resolves.
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  // A `#profile/<unknown-user>` deep link resolves to a target that getUserByName
  // 404s on — track it to show an empty placeholder instead of a perpetual loader.
  const [isUserNotFound, setIsUserNotFound] = useState(false);
  // Monotonic request id: a target change (e.g. #profile/bob → #profile/alice,
  // or back to the current user) bumps it so a slower earlier response can't
  // overwrite a faster later one and strand the wrong user's data.
  const requestRef = useRef(0);
  // Read the latest currentUser inside fetchUser without listing it as a dep —
  // the store object identity can change between renders and would otherwise
  // re-fire the fetch effect in a loop.
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const { state: hashState, setHash } = useSettingsHash();

  // The `profile` tab may deep-link to another user via its sub-path
  // (`#profile/<username>`); fall back to the current user when absent.
  const { targetUsername, isViewingOtherUser } = useMemo(() => {
    const username =
      hashState.tab === 'profile' && hashState.subPath
        ? safeDecodeURIComponent(hashState.subPath)
        : currentUser?.name;

    return {
      targetUsername: username,
      isViewingOtherUser: Boolean(
        username && currentUser?.name && username !== currentUser.name
      ),
    };
  }, [hashState, currentUser?.name]);

  const [selectedId, setSelectedId] = useState<ProfileNavId>(
    (hashState.tab as ProfileNavId) || DEFAULT_PROFILE_NAV_ID
  );

  // Allows panels (e.g. Access Control) to override the header breadcrumbs
  // and title without needing a separate route.
  const [headerOverride, setHeaderOverride] =
    useState<ProfileHeaderOverride | null>(null);

  // Follow hash tab changes (e.g. deep link, back navigation). A hash-driven
  // cross-tab jump (e.g. team detail → a user profile) must also drop the
  // previous tab's header override, otherwise its stale breadcrumb/title leaks
  // into the new tab until that tab sets its own.
  useEffect(() => {
    if (hashState.tab && hashState.tab !== selectedId) {
      setSelectedId(hashState.tab as ProfileNavId);
      setHeaderOverride(null);
    }
  }, [hashState.tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUser = useCallback(async () => {
    if (!targetUsername) {
      setIsProfileLoading(false);

      return;
    }
    const reqId = ++requestRef.current;
    setIsProfileLoading(true);
    setIsUserNotFound(false);
    // Reset on every target change (not only when viewing another user): going
    // back to your own profile must drop the previously-viewed user so their
    // data — and their id in updateUserDetails — can't linger. For the current
    // user we fall back to the store seed to avoid a flash of the loader.
    setUserData(
      isViewingOtherUser ? undefined : (currentUserRef.current as User)
    );
    try {
      const res = await getUserByName(targetUsername, {
        fields: [
          TabSpecificField.PROFILE,
          TabSpecificField.ROLES,
          TabSpecificField.TEAMS,
          TabSpecificField.PERSONAS,
          TabSpecificField.DEFAULT_PERSONA,
          TabSpecificField.DOMAINS,
        ],
        include: Include.All,
      });
      // Ignore a stale response superseded by a newer target.
      if (reqId === requestRef.current) {
        // isAdmin is not in the fields list but is used by contributed-tab
        // conditions (e.g. billing tab). Keep the fetched value when present;
        // fall back to the logged-in user's flag only for your own profile so
        // viewing another user's profile doesn't overwrite their isAdmin with ours.
        setUserData({
          ...res,
          isAdmin:
            res.isAdmin ??
            (isViewingOtherUser ? undefined : currentUserRef.current?.isAdmin),
        });
      }
    } catch (error) {
      if (reqId !== requestRef.current) {
        return;
      }
      // A 404 is an expected miss (e.g. a hand-typed hash) — show the empty
      // placeholder. Surface everything else (500s, network, 403) as a toast
      // rather than silently masquerading as "user not found".
      if ((error as AxiosError).response?.status === 404) {
        setIsUserNotFound(true);
      } else {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (reqId === requestRef.current) {
        setIsProfileLoading(false);
      }
    }
  }, [targetUsername, isViewingOtherUser]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const updateUserDetails = useCallback(
    async (data: Partial<User>, key: keyof User) => {
      if (!userData) {
        return;
      }
      const updatedDetails: User = { ...userData, ...data };
      const jsonPatch = compare(userData, updatedDetails);
      try {
        const response = await updateUserDetail(userData.id, jsonPatch);
        if (!response) {
          return;
        }
        const nonTeamKeyData =
          key === 'roles'
            ? { roles: response.roles, isAdmin: response.isAdmin }
            : { [key]: response[key] };
        const updatedKeyData =
          key === 'teams'
            ? { teams: response.teams, domains: response.domains }
            : nonTeamKeyData;
        const newUserData = omitBy(
          { ...userData, ...updatedKeyData },
          isUndefined
        ) as unknown as User;
        setUserData(newUserData);
        showSuccessToast(
          t('server.update-entity-success', { entity: t('label.profile') })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [userData, t]
  );

  // Plugins (e.g. Query Runner's "My Connections") contribute extra profile
  // tabs through the `profile.tabs` extension point. Map each surviving
  // contribution onto a credentials-group nav item; `isAiMode` lets a plugin
  // pick the app-mode variant of a tab it also contributes to classic pages.
  const navItems: ProfileNavItem[] = useMemo(() => {
    const isAdmin = Boolean(currentUser?.isAdmin);
    const coreItems = PROFILE_NAV_ITEMS.filter(
      (item) => !item.isVisible || item.isVisible(permissions, isAdmin)
    );

    if (!userData) {
      return coreItems;
    }
    const context: PluginEntityDetailsContext = {
      userData,
      isLoggedInUser: true,
      isAiMode: true,
    };
    const contributed: ProfileNavItem[] = extensionRegistry
      .getContributions<TabContribution>(EXTENSION_POINTS.PROFILE_TABS)
      .filter(
        (tab) => !tab.isHidden && (!tab.condition || tab.condition(context))
      )
      .map((tab) => {
        const TabComponent = tab.component;

        return {
          id: tab.key as ProfileNavId,
          group: (tab.group ?? 'credentials') as ProfileNavGroup,
          label: typeof tab.label === 'string' ? tab.label : tab.key,
          description: tab.description ?? '',
          icon: (tab.icon ?? Link01) as FC<{ className?: string }>,
          selfContainedLayout: tab.selfContainedLayout,
          render: ({
            onHeaderChange,
          }: {
            onHeaderChange?: (override: ProfileHeaderOverride | null) => void;
          }) => <TabComponent {...context} onHeaderChange={onHeaderChange} />,
        };
      });

    const workspaceItems = WORKSPACE_NAV_ITEMS.filter(
      (item) => !item.isVisible || item.isVisible(permissions, isAdmin)
    );

    const applicationItems = APPLICATION_NAV_ITEMS.filter(
      (item) => !item.isVisible || item.isVisible(permissions, isAdmin)
    );

    const featuresItems = FEATURES_NAV_ITEMS.filter(
      (item) => !item.isVisible || item.isVisible(permissions, isAdmin)
    );

    return [
      ...coreItems,
      ...workspaceItems,
      ...applicationItems,
      ...featuresItems,
      ...contributed,
    ];
  }, [currentUser?.isAdmin, extensionRegistry, permissions, userData]);

  // Clear header override whenever the user switches nav items. The profile tab
  // carries the current user's name as its sub-path (`#profile/<username>`) so
  // the URL is shareable/deep-linkable; other tabs own their own sub-paths.
  const handleNavSelect = useCallback(
    (id: ProfileNavId) => {
      if (id === selectedId) {
        return;
      }
      setSelectedId(id);
      setHeaderOverride(null);
      setHash(
        id,
        // Encode so usernames containing `%`/`?` round-trip through the hash.
        id === DEFAULT_PROFILE_NAV_ID && currentUser?.name
          ? encodeURIComponent(currentUser.name)
          : undefined
      );
    },
    [selectedId, setHash, currentUser?.name]
  );

  const activeItem =
    navItems.find((item) => item.id === selectedId) ?? navItems[0];

  // Resolve header props — prefer panel-supplied override, fall back to defaults.
  const headerIcon = headerOverride?.icon ?? activeItem.icon;
  // Always the static nav label (e.g. "Profile") — never the viewed user's name,
  // for either your own or another user's profile.
  const headerTitle = headerOverride?.title ?? t(activeItem.label);
  const headerDescription =
    headerOverride?.description ?? t(activeItem.description);
  const headerBreadcrumbRoot = t(PROFILE_NAV_GROUP_LABEL[activeItem.group]);
  // Tie the breadcrumb to the nav item, not the (possibly user-name-overridden)
  // title — so viewing another user's profile still reads "Settings > Profile".
  const headerBreadcrumbs = headerOverride?.breadcrumbs ?? [
    { id: 'root', label: headerBreadcrumbRoot },
    { id: 'current', label: t(activeItem.label) },
  ];
  const headerBreadcrumbAction = headerOverride?.onBreadcrumbAction;

  // Extracted so the nested loading/not-found branching lives in its own function
  // (keeps the component's cyclomatic complexity down and avoids a nested ternary).
  const renderContent = () => {
    if (!userData) {
      if (isUserNotFound) {
        return (
          <Box className="tw:relative tw:flex-1">
            <EmptyPlaceholder
              icon={User01}
              title={t('label.no-entity-found', { entity: t('label.user') })}
            />
          </Box>
        );
      }

      return <Loader />;
    }

    const panel = activeItem.render({
      userData,
      isProfileLoading,
      updateUserDetails,
      onHeaderChange: setHeaderOverride,
    });

    return (
      <>
        <ProfileSideNav
          items={navItems}
          selectedId={selectedId}
          onSelect={handleNavSelect}
        />
        <Box
          className="tw:min-h-0 tw:flex-1 tw:overflow-hidden"
          direction="col">
          <ProfileContentHeader
            actions={headerOverride?.actions}
            breadcrumbRoot={headerBreadcrumbRoot}
            breadcrumbs={headerBreadcrumbs}
            description={headerDescription}
            icon={headerIcon}
            iconNode={headerOverride?.iconNode}
            title={headerTitle}
            titleInput={headerOverride?.titleInput}
            titleSuffix={headerOverride?.titleSuffix}
            onBreadcrumbAction={headerBreadcrumbAction}
          />
          {activeItem.selfContainedLayout ? (
            <React.Fragment key={selectedId}>{panel}</React.Fragment>
          ) : (
            <div
              className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0"
              data-testid="profile-content-body"
              key={selectedId}>
              {panel}
            </div>
          )}
        </Box>
      </>
    );
  };

  return (
    <Box
      className="ai-profile-page tw:min-h-0 tw:flex-1 tw:overflow-hidden"
      data-testid="ai-profile-page"
      direction="row">
      {renderContent()}
    </Box>
  );
};

export default ProfilePage;
