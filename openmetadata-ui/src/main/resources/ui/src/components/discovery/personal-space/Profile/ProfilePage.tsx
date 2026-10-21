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
import { Link01 } from '@openmetadata/ui-core-components/icons';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../../../components/common/Loader/Loader';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { User } from '../../../../generated/entity/teams/user';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { usePersonalSpaceStore } from '../../../../hooks/usePersonalSpaceStore';
import { useEditableUser } from '../../../../hooks/user-profile/useEditableUser';
import { useSettingsHash } from '../../../../hooks/useSettingsHash';
import {
  EXTENSION_POINTS,
  PluginEntityDetailsContext,
  TabContribution,
} from '../../../../utils/ExtensionPointTypes';
import { getUserPath } from '../../../../utils/RouterUtils';
import { useApplicationsProvider } from '../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import './profile-page.less';
import ProfileContentHeader from './ProfileContentHeader';
import {
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
import { profileHash } from './tabs/members/profileHash.utils';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { permissions } = usePermissionProvider();
  const { extensionRegistry } = useApplicationsProvider();
  // The Profile tab is always the logged-in user; other users open in the
  // Members edit view (`#members/user/<name>`).
  const {
    userData,
    isLoading: isProfileLoading,
    updateUserDetails,
  } = useEditableUser(currentUser?.name, currentUser as User | undefined);
  const { state: hashState, setHash } = useSettingsHash();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState<ProfileNavId>(
    (hashState.tab as ProfileNavId) || DEFAULT_PROFILE_NAV_ID
  );

  // Allows panels (e.g. Access Control) to override the header breadcrumbs
  // and title without needing a separate route.
  const [headerOverride, setHeaderOverride] =
    useState<ProfileHeaderOverride | null>(null);

  // Follow hash tab changes (e.g. deep link, back navigation). A hash-driven
  // cross-tab jump (e.g. team detail → a user) must also drop the previous
  // tab's header override, otherwise its stale breadcrumb/title leaks into the
  // new tab until that tab sets its own.
  useEffect(() => {
    if (hashState.tab && hashState.tab !== selectedId) {
      setSelectedId(hashState.tab as ProfileNavId);
      setHeaderOverride(null);
    }
  }, [hashState.tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Old `#profile/<username>` links (bookmarks, shared URLs) predate the edit
  // view: your own name collapses to `#profile`; anyone else's opens their Edit
  // User form for admins, and the read-only classic user page for everyone
  // else, who can't reach the admin-only Members tab.
  useEffect(() => {
    if (hashState.tab !== DEFAULT_PROFILE_NAV_ID || !hashState.subPath) {
      return;
    }
    const linkedName = safeDecodeURIComponent(hashState.subPath);
    if (linkedName === currentUser?.name) {
      setHash(DEFAULT_PROFILE_NAV_ID);
    } else if (currentUser?.isAdmin) {
      const target = profileHash.user(linkedName);
      setHash(target.tab, target.subPath);
    } else {
      // Leaving the modal's route drops the hash, which closes the modal.
      navigate(getUserPath(linkedName), { replace: true });
    }
  }, [
    hashState.tab,
    hashState.subPath,
    currentUser?.name,
    currentUser?.isAdmin,
    setHash,
    navigate,
  ]);

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

    const featuresItems = FEATURES_NAV_ITEMS.filter(
      (item) => !item.isVisible || item.isVisible(permissions, isAdmin)
    );

    return [...coreItems, ...workspaceItems, ...featuresItems, ...contributed];
  }, [currentUser?.isAdmin, extensionRegistry, permissions, userData]);

  // Clear header override whenever the user switches nav items.
  const handleNavSelect = useCallback(
    (id: ProfileNavId) => {
      if (id === selectedId) {
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
    [selectedId, setHash]
  );

  const activeItem =
    navItems.find((item) => item.id === selectedId) ?? navItems[0];

  // Resolve header props — prefer panel-supplied override, fall back to defaults.
  const headerIcon = headerOverride?.icon ?? activeItem.icon;
  const headerTitle = headerOverride?.title ?? t(activeItem.label);
  const headerDescription =
    headerOverride?.description ?? t(activeItem.description);
  const headerBreadcrumbRoot = t(PROFILE_NAV_GROUP_LABEL[activeItem.group]);
  const headerBreadcrumbs = headerOverride?.breadcrumbs ?? [
    { id: 'root', label: headerBreadcrumbRoot },
    { id: 'current', label: t(activeItem.label) },
  ];
  const headerBreadcrumbAction = headerOverride?.onBreadcrumbAction;

  // Extracted so the nested loading/not-found branching lives in its own function
  // (keeps the component's cyclomatic complexity down and avoids a nested ternary).
  const renderContent = () => {
    if (!userData) {
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
