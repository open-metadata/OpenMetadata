/*
 *  Copyright 2022 Collate.
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

import { Col, Row, Tabs } from 'antd';
import { Tooltip } from '../../common/AntdCompat';;
import { AxiosError } from 'axios';
import { noop } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { EntityType } from '../../../enums/entity.enum';
import { useAuth } from '../../../hooks/authHooks';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../hooks/useFqn';
import { restoreUser } from '../../../rest/userAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import ActivityFeedProvider from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import {
  ActivityFeedLayoutType,
  ActivityFeedTabs,
} from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import { DomainLabelNew } from '../../common/DomainLabel/DomainLabelNew';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import EntitySummaryPanel from '../../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from '../../Explore/ExplorePage.interface';
import AssetsTabs from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import {
  AssetNoDataPlaceholderProps,
  AssetsOfEntity,
} from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import ProfileSectionUserDetailsCard from '../../ProfileCard/ProfileSectionUserDetailsCard.component';
import AccessTokenCard from './AccessTokenCard/AccessTokenCard.component';
import UserProfilePersonas from './UserProfilePersona/UserProfilePersona.component';
import { Props, UserPageTabs } from './Users.interface';
import './users.less';
import UserPermissions from './UsersProfile/UserPermissions/UserPermissions.component';
import UserProfileRoles from './UsersProfile/UserProfileRoles/UserProfileRoles.component';
import UserProfileTeams from './UsersProfile/UserProfileTeams/UserProfileTeams.component';

const Users = ({
  afterDeleteAction,
  userData,
  queryFilters,
  updateUserDetails,
}: Props) => {
  const { tab: activeTab = UserPageTabs.ACTIVITY, subTab } = useRequiredParams<{
    tab: UserPageTabs;
    subTab: ActivityFeedTabs;
  }>();
  const { fqn: decodedUsername } = useFqn();
  const { isAdminUser } = useAuth();
  const navigate = useNavigate();
  const location = useCustomLocation();
  const { currentUser } = useApplicationStore();
  const [currentTab, setCurrentTab] = useState<UserPageTabs>(activeTab);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();

  const { t } = useTranslation();
  const { getResourceLimit } = useLimitStore();

  const [disableFields, setDisableFields] = useState<string[]>([]);

  const isLoggedInUser = useMemo(
    () => decodedUsername === currentUser?.name,
    [decodedUsername]
  );

  const initLimits = async () => {
    const limits = await getResourceLimit('user', false);

    setDisableFields(limits.configuredLimit.disabledFields ?? []);
  };

  const activeTabHandler = (activeKey: string) => {
    location.search = '';
    if (activeKey !== currentTab) {
      navigate({
        pathname: getUserPath(decodedUsername, activeKey),
        search: location.search,
      });
    }
    setCurrentTab(activeKey as UserPageTabs);
  };

  const handleAssetClick = useCallback(
    (asset?: EntityDetailsObjectInterface) => {
      setPreviewAsset(asset);
    },
    []
  );

  const handleTabRedirection = useCallback(() => {
    if (!isLoggedInUser && activeTab === UserPageTabs.ACCESS_TOKEN) {
      navigate({
        pathname: getUserPath(decodedUsername, UserPageTabs.ACTIVITY),
        search: location.search,
      });
    }
  }, [activeTab, decodedUsername, isLoggedInUser]);

  useEffect(() => {
    handleTabRedirection();
    initLimits();
  }, []);

  const tabDataRender = useCallback(
    (props: {
      queryFilter: string;
      type: AssetsOfEntity;
      noDataPlaceholder: AssetNoDataPlaceholderProps;
    }) => (
      <Row
        className="user-page-layout"
        gutter={[20, 0]}
        key={currentTab}
        wrap={false}>
        <Col flex="auto">
          <div className="user-layout-scroll">
            <AssetsTabs
              isSummaryPanelOpen={Boolean(previewAsset)}
              permissions={{ ...DEFAULT_ENTITY_PERMISSION, Create: true }}
              onAddAsset={() => navigate(ROUTES.EXPLORE)}
              onAssetClick={handleAssetClick}
              {...props}
            />
          </div>
        </Col>

        {previewAsset && (
          <Col className="user-page-layout-right-panel" flex="400px">
            <EntitySummaryPanel
              entityDetails={previewAsset}
              handleClosePanel={() => setPreviewAsset(undefined)}
            />
          </Col>
        )}
      </Row>
    ),
    [previewAsset, handleAssetClick, setPreviewAsset, currentTab]
  );
  useEffect(() => {
    if (
      subTab === ActivityFeedTabs.MENTIONS ||
      subTab === ActivityFeedTabs.TASKS
    ) {
      setCurrentTab(UserPageTabs.TASK);
    }
  }, [subTab]);
  const tabs = useMemo(
    () => [
      {
        label: (
          <TabsLabel
            id={UserPageTabs.ACTIVITY}
            isActive={currentTab === UserPageTabs.ACTIVITY}
            name={t('label.activity')}
          />
        ),
        key: UserPageTabs.ACTIVITY,
        children: (
          <ActivityFeedProvider user={userData.id}>
            <ActivityFeedTab
              entityType={EntityType.USER}
              isForFeedTab={false}
              layoutType={ActivityFeedLayoutType.TWO_PANEL}
              subTab={ActivityFeedTabs.ALL}
              onFeedUpdate={noop}
            />
          </ActivityFeedProvider>
        ),
      },
      {
        label: (
          <TabsLabel
            data-testid="user-profile-page-task-tab"
            id={UserPageTabs.TASK}
            isActive={currentTab === UserPageTabs.TASK}
            name={t('label.task-plural')}
          />
        ),
        key: UserPageTabs.TASK,
        children: (
          <ActivityFeedProvider user={userData.id}>
            <ActivityFeedTab
              entityType={EntityType.USER}
              isForFeedTab={false}
              subTab={ActivityFeedTabs.TASKS}
              onFeedUpdate={noop}
            />
          </ActivityFeedProvider>
        ),
      },
      {
        label: (
          <TabsLabel
            id={UserPageTabs.MY_DATA}
            isActive={activeTab === UserPageTabs.MY_DATA}
            name={t('label.my-data')}
          />
        ),
        key: UserPageTabs.MY_DATA,
        children: tabDataRender({
          queryFilter: queryFilters.myData,
          type: AssetsOfEntity.MY_DATA,
          noDataPlaceholder: {
            message: t('server.no-records-found'),
          },
        }),
      },
      {
        label: (
          <TabsLabel
            id={UserPageTabs.FOLLOWING}
            isActive={activeTab === UserPageTabs.FOLLOWING}
            name={t('label.following')}
          />
        ),
        key: UserPageTabs.FOLLOWING,
        children: tabDataRender({
          queryFilter: queryFilters.following,
          type: AssetsOfEntity.FOLLOWING,
          noDataPlaceholder: {
            message: t('server.no-records-found'),
          },
        }),
      },
      {
        label: (
          <TabsLabel
            id={UserPageTabs.PERMISSIONS}
            isActive={activeTab === UserPageTabs.PERMISSIONS}
            name={t('label.permissions')}
          />
        ),
        key: UserPageTabs.PERMISSIONS,
        children: (
          <UserPermissions
            isLoggedInUser={isLoggedInUser}
            username={userData.name}
          />
        ),
      },
      ...(isLoggedInUser
        ? [
            {
              label: (
                <Tooltip title="You have reached the limit">
                  <TabsLabel
                    id={UserPageTabs.ACCESS_TOKEN}
                    isActive={activeTab === UserPageTabs.ACCESS_TOKEN}
                    name={t('label.access-token')}
                  />
                </Tooltip>
              ),
              disabled: disableFields.includes('personalAccessToken'),
              key: UserPageTabs.ACCESS_TOKEN,
              children: <AccessTokenCard isBot={false} />,
            },
          ]
        : []),
    ],
    [
      currentTab,
      userData.id,
      userData.name,
      decodedUsername,
      setPreviewAsset,
      tabDataRender,
      disableFields,
      subTab,
      isLoggedInUser,
    ]
  );

  const handleRestoreUser = useCallback(async () => {
    try {
      await restoreUser(userData.id);
      afterDeleteAction(true);

      showSuccessToast(
        t('message.entity-restored-success', { entity: t('label.user') })
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', { entity: t('label.user') })
      );
    }
  }, [userData.id]);

  return (
    <div data-testid="user-profile">
      <Row gutter={[20, 0]} wrap={false}>
        <Col flex="250px">
          <div className="profile-section">
            <ProfileSectionUserDetailsCard
              afterDeleteAction={afterDeleteAction}
              handleRestoreUser={handleRestoreUser}
              updateUserDetails={updateUserDetails}
              userData={userData}
            />
            <UserProfilePersonas
              updateUserDetails={updateUserDetails}
              userData={userData}
            />
            <DomainLabelNew
              multiple
              domains={userData?.domains ?? []}
              entityFqn={userData.fullyQualifiedName ?? ''}
              entityId={userData.id ?? ''}
              entityType={EntityType.USER}
              hasPermission={Boolean(isAdminUser) && !userData.deleted}
              textClassName="text-sm text-grey-muted"
              userData={userData}
            />
            <UserProfileTeams
              isDeletedUser={userData.deleted}
              teams={userData.teams}
              updateUserDetails={updateUserDetails}
            />
            <UserProfileRoles
              isDeletedUser={userData.deleted}
              isUserAdmin={userData.isAdmin}
              updateUserDetails={updateUserDetails}
              userData={userData}
              userRoles={userData.roles}
            />
          </div>
        </Col>
        <Col flex="auto">
          <Tabs
            activeKey={currentTab}
            className="tabs-new m-b-xs"
            data-testid="tabs"
            items={tabs.map((tab) => ({
              key: tab.key,
              label: tab.label,
              disabled: tab.disabled,
            }))}
            renderTabBar={(props, DefaultTabBar) => (
              <DefaultTabBar {...props} />
            )}
            onChange={activeTabHandler}
          />
          <Row className="users-tabs-container" gutter={[16, 16]}>
            <Col span={24}>
              {tabs.find((tab) => tab.key === currentTab)?.children}
            </Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default Users;
