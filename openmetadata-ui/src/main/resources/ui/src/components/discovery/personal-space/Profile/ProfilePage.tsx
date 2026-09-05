/*
 *  Copyright 2025 Collate.
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
import { Link01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined, omitBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../../../components/common/Loader/Loader';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { User } from '../../../../generated/entity/teams/user';
import { Include } from '../../../../generated/type/include';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
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
  DEFAULT_PROFILE_NAV_ID,
  ProfileNavGroup,
  ProfileNavId,
  ProfileNavItem,
  PROFILE_NAV_GROUP_LABEL,
  PROFILE_NAV_ITEMS,
} from './profileNavConfig';
import ProfileSideNav from './ProfileSideNav';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
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
  const [selectedId, setSelectedId] = useState<ProfileNavId>(
    DEFAULT_PROFILE_NAV_ID
  );

  const fetchUser = useCallback(async () => {
    if (!currentUser?.name) {
      setIsProfileLoading(false);

      return;
    }
    setIsProfileLoading(true);
    try {
      const res = await getUserByName(currentUser.name, {
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
      setUserData(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsProfileLoading(false);
    }
  }, [currentUser?.name]);

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
    if (!userData) {
      return PROFILE_NAV_ITEMS;
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
          group: 'credentials' as ProfileNavGroup,
          label: typeof tab.label === 'string' ? tab.label : tab.key,
          description: tab.description ?? '',
          icon: tab.icon ?? Link01,
          render: () => <TabComponent {...context} />,
        };
      });

    return [...PROFILE_NAV_ITEMS, ...contributed];
  }, [extensionRegistry, userData]);

  const activeItem =
    navItems.find((item) => item.id === selectedId) ?? navItems[0];

  return (
    <Box
      className="ai-profile-page tw:flex tw:min-h-0 tw:flex-1 tw:overflow-hidden"
      data-testid="ai-profile-page"
      direction="row">
      {!userData ? (
        <Loader />
      ) : (
        <>
          <ProfileSideNav
            items={navItems}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <Box
            className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden"
            direction="col">
            <ProfileContentHeader
              breadcrumbRoot={t(PROFILE_NAV_GROUP_LABEL[activeItem.group])}
              description={t(activeItem.description)}
              icon={activeItem.icon}
              title={t(activeItem.label)}
            />
            <div
              className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0 "
              data-testid="profile-content-body">
              {activeItem.render({
                userData,
                isProfileLoading,
                updateUserDetails,
              })}
            </div>
          </Box>
        </>
      )}
    </Box>
  );
};

export default ProfilePage;
