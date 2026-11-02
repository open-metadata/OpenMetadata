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
import { Link01, User01 } from '@openmetadata/ui-core-components/icons';
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
import { useUserProfile } from '../../../../hooks/discovery/personal-space/useUserProfile';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { usePersonalSpaceStore } from '../../../../hooks/usePersonalSpaceStore';
import { useSettingsHash } from '../../../../hooks/useSettingsHash';
import {
  EXTENSION_POINTS,
  PluginEntityDetailsContext,
  TabContribution,
} from '../../../../utils/ExtensionPointTypes';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';
import PermissionPlaceholder from '../../../common/EmptyPlaceholder/PermissionPlaceholder';
import { useApplicationsProvider } from '../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import './profile-page.less';
import ProfileContentHeader from './ProfileContentHeader';
import {
  DEFAULT_PROFILE_NAV_ID,
  FEATURES_NAV_ITEMS,
  getProfileNavItem,
  ProfileHeaderOverride,
  ProfileNavGroup,
  ProfileNavId,
  ProfileNavItem,
  PROFILE_NAV_GROUP_LABEL,
  PROFILE_NAV_ITEMS,
  WORKSPACE_NAV_ITEMS,
} from './profileNavConfig';
import ProfileSideNav from './ProfileSideNav';
import { getMembersAccess } from './tabs/members/Members.utils';
import {
  getProfileUserDetailView,
  hashSubPathToView as membersHashToView,
  userViewToProfileSubPath,
} from './tabs/members/membersRoute.utils';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { permissions, isPermissionsLoading } = usePermissionProvider();
  const { getContributions, contributionsReady } = useApplicationsProvider();
  const { state: hashState, setHash } = useSettingsHash();

  // Every nav item is about the signed-in user; another user deep-linked as
  // `#profile/<username>` is loaded by the profile tab's own user detail.
  const {
    userData,
    isProfileLoading,
    isUserNotFound,
    loadError,
    updateUserDetails,
    refetch,
    refresh,
  } = useUserProfile(currentUser?.name);
  // A user detail is open under Profile: someone else's, or a tab of yours.
  const isViewingUserDetail =
    hashState.tab === DEFAULT_PROFILE_NAV_ID &&
    Boolean(currentUser?.name) &&
    Boolean(getProfileUserDetailView(hashState.subPath, currentUser?.name));

  const [selectedId, setSelectedId] = useState<ProfileNavId>(
    (hashState.tab as ProfileNavId) || DEFAULT_PROFILE_NAV_ID
  );

  // The user detail (Members, or `#profile/<you>/<tab>`) loads and saves its own
  // copy of you, so this page's copy goes stale while you edit there. Re-read it
  // in place when your own Profile comes back into view; not on the first
  // render, which the hook already loads.
  const isOwnProfileShown =
    selectedId === DEFAULT_PROFILE_NAV_ID && !isViewingUserDetail;
  const wasOwnProfileShownRef = useRef(isOwnProfileShown);
  useEffect(() => {
    if (isOwnProfileShown && !wasOwnProfileShownRef.current) {
      refresh();
    }
    wasOwnProfileShownRef.current = isOwnProfileShown;
  }, [isOwnProfileShown, refresh]);

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

  // User links open `#members/user/<name>`; a viewer who may not browse users
  // there gets the same read-only detail under `#profile/<name>`.
  useEffect(() => {
    if (hashState.tab !== 'members' || isPermissionsLoading) {
      return;
    }
    const view = membersHashToView(hashState.subPath ?? '');
    const isAdmin = Boolean(currentUser?.isAdmin);
    if (
      view.type === 'user-detail' &&
      !getMembersAccess(permissions, isAdmin).users
    ) {
      setHash(DEFAULT_PROFILE_NAV_ID, userViewToProfileSubPath(view));
    }
  }, [
    currentUser?.isAdmin,
    hashState.subPath,
    hashState.tab,
    isPermissionsLoading,
    permissions,
    setHash,
  ]);

  // Plugins (e.g. Query Runner's "My Connections") contribute extra profile
  // tabs through the `profile.tabs` extension point. Read them through
  // `getContributions`, whose identity changes once plugins have registered —
  // the registry itself never changes identity, so a refresh on a contributed
  // tab's hash would otherwise never see it. Map each surviving
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
    // `username` matches the classic user page's plugin context.
    const context: PluginEntityDetailsContext & { username: string } = {
      userData,
      username: userData.name,
      isLoggedInUser: true,
      isAiMode: true,
    };
    const contributed: ProfileNavItem[] = getContributions<TabContribution>(
      EXTENSION_POINTS.PROFILE_TABS
    )
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

    const featuresItems = FEATURES_NAV_ITEMS.filter(
      (item) => !item.isVisible || item.isVisible(permissions, isAdmin)
    );

    return [...coreItems, ...workspaceItems, ...featuresItems, ...contributed];
  }, [currentUser?.isAdmin, getContributions, permissions, userData]);

  // Clear header override whenever the user switches nav items.
  const handleNavSelect = useCallback(
    (id: ProfileNavId) => {
      // Profile stays clickable while another user's detail is open under it.
      if (id === selectedId && !isViewingUserDetail) {
        return;
      }
      const switchTab = () => {
        setSelectedId(id);
        setHeaderOverride(null);
        setHash(id);
      };
      // A dirty in-modal editor (e.g. persona customize) may prompt first.
      if (!usePersonalSpaceStore.getState().exitGuard?.(switchTab)) {
        switchTab();
      }
    },
    [selectedId, isViewingUserDetail, setHash]
  );

  // A tab the user cannot see (e.g. a settings link to a team for a user
  // without team view permission) keeps its header and shows no-access rather
  // than silently opening another tab.
  const selectedItem = navItems.find((item) => item.id === selectedId);
  const activeItem = selectedItem ?? getProfileNavItem(selectedId);

  // Resolve header props — prefer panel-supplied override, fall back to defaults.
  const headerIcon = headerOverride?.icon ?? activeItem.icon;
  // The static nav label unless a panel overrides it (the profile tab shows the
  // user's identity instead).
  const headerTitle = headerOverride?.title ?? t(activeItem.label);
  const headerDescription =
    headerOverride?.description ?? t(activeItem.description);
  const headerBreadcrumbRoot = t(PROFILE_NAV_GROUP_LABEL[activeItem.group]);
  // Tie the breadcrumb to the nav item, not the (possibly user-name-overridden)
  // title — so your own profile reads "Account > Profile".
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
            <NoDataPlaceholder
              icon={User01}
              title={t('label.no-entity-found', { entity: t('label.user') })}
            />
          </Box>
        );
      }

      return <Loader />;
    }

    // Permissions and plugin contributions load after the page mounts; until
    // both are in, a permission-gated or contributed tab (e.g. `#billing`)
    // reads as missing, so wait instead of flashing no-access. Wait on the
    // provider's loading flag, not on an empty map: a failed request leaves
    // the map empty for good and must show no-access, not spin forever.
    if (!selectedItem && (isPermissionsLoading || !contributionsReady)) {
      return <Loader />;
    }

    const panel = selectedItem ? (
      activeItem.render({
        userData,
        isProfileLoading,
        loadError,
        onReload: refetch,
        updateUserDetails,
        onHeaderChange: setHeaderOverride,
      })
    ) : (
      <Box className="tw:relative tw:flex-1">
        <PermissionPlaceholder permissionValue={t('label.view')} />
      </Box>
    );

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
            compact={headerOverride?.compact}
            description={headerDescription}
            icon={headerIcon}
            iconNode={headerOverride?.iconNode}
            meta={headerOverride?.meta}
            tabs={headerOverride?.tabs}
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
