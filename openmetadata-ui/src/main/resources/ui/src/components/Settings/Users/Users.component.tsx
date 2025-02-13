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

import { Col, Collapse, Row, Space, Tabs, Tooltip, Typography } from 'antd';
import Card from 'antd/lib/card/Card';
import { isEmpty, noop } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ReactComponent as PersonaIcon } from '../../../assets/svg/ic-personas.svg';
import { getUserPath, ROUTES } from '../../../constants/constants';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useAuth } from '../../../hooks/authHooks';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../hooks/useFqn';
import { searchData } from '../../../rest/miscAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import ActivityFeedProvider from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import Chip from '../../common/Chip/Chip.component';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import EntitySummaryPanel from '../../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { EntityDetailsObjectInterface } from '../../Explore/ExplorePage.interface';
import AssetsTabs from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import {
  AssetNoDataPlaceholderProps,
  AssetsOfEntity,
} from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { PersonaSelectableList } from '../../MyData/Persona/PersonaSelectableList/PersonaSelectableList.component';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import AccessTokenCard from './AccessTokenCard/AccessTokenCard.component';
import { Props, UserPageTabs } from './Users.interface';
import './users.less';
import UserProfileDetails from './UsersProfile/UserProfileDetails/UserProfileDetails.component';
import UserProfileInheritedRoles from './UsersProfile/UserProfileInheritedRoles/UserProfileInheritedRoles.component';
import UserProfileRoles from './UsersProfile/UserProfileRoles/UserProfileRoles.component';
import UserProfileTeams from './UsersProfile/UserProfileTeams/UserProfileTeams.component';

const Users = ({
  afterDeleteAction,
  userData,
  queryFilters,
  updateUserDetails,
}: Props) => {
  const { tab: activeTab = UserPageTabs.ACTIVITY } =
    useParams<{ tab: UserPageTabs }>();
  const { fqn: decodedUsername } = useFqn();
  const [assetCount, setAssetCount] = useState<number>(0);
  const { isAdminUser } = useAuth();
  const history = useHistory();
  const location = useCustomLocation();
  const { currentUser } = useApplicationStore();

  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();

  const [isDescriptionEdit, setIsDescriptionEdit] = useState(false);
  const { t } = useTranslation();
  const { getResourceLimit } = useLimitStore();

  const [disableFields, setDisableFields] = useState<string[]>([]);

  const isLoggedInUser = useMemo(
    () => decodedUsername === currentUser?.name,
    [decodedUsername]
  );

  const hasEditPermission = useMemo(
    () => Boolean(isAdminUser) && !userData.deleted,
    [isAdminUser, userData.deleted]
  );

  const fetchAssetsCount = async (query: string) => {
    try {
      const res = await searchData('', 1, 0, query, '', '', SearchIndex.ALL);

      setAssetCount(res.data.hits.total.value ?? 0);
    } catch (error) {
      setAssetCount(0);
    }
  };

  const initLimits = async () => {
    const limits = await getResourceLimit('user', false);

    setDisableFields(limits.configuredLimit.disabledFields ?? []);
  };

  const activeTabHandler = (activeKey: string) => {
    // To reset search params appends from other page for proper navigation
    location.search = '';
    if (activeKey !== activeTab) {
      history.push({
        pathname: getUserPath(decodedUsername, activeKey),
        search: location.search,
      });
    }
  };

  const handleAssetClick = useCallback((asset) => {
    setPreviewAsset(asset);
  }, []);

  const handleTabRedirection = useCallback(() => {
    if (!isLoggedInUser && activeTab === UserPageTabs.ACCESS_TOKEN) {
      history.push({
        pathname: getUserPath(decodedUsername, UserPageTabs.ACTIVITY),
        search: location.search,
      });
    }
  }, [activeTab, decodedUsername, isLoggedInUser]);

  useEffect(() => {
    handleTabRedirection();
    initLimits();
  }, []);

  const handlePersonaUpdate = useCallback(
    async (personas: EntityReference[]) => {
      await updateUserDetails({ personas }, 'personas');
    },
    [updateUserDetails]
  );

  const tabDataRender = useCallback(
    (props: {
      queryFilter: string;
      type: AssetsOfEntity;
      noDataPlaceholder: AssetNoDataPlaceholderProps;
    }) => (
      <Row className="user-page-layout" wrap={false}>
        <Col className="user-layout-scroll" flex="auto">
          <AssetsTabs
            isSummaryPanelOpen
            assetCount={assetCount}
            permissions={{ ...DEFAULT_ENTITY_PERMISSION, Create: true }}
            onAddAsset={() => history.push(ROUTES.EXPLORE)}
            onAssetClick={handleAssetClick}
            {...props}
          />
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
    [previewAsset, assetCount, handleAssetClick, setPreviewAsset]
  );

  const tabs = useMemo(
    () => [
      {
        label: (
          <TabsLabel
            id={UserPageTabs.ACTIVITY}
            isActive={activeTab === UserPageTabs.ACTIVITY}
            name={t('label.activity')}
          />
        ),
        key: UserPageTabs.ACTIVITY,
        children: (
          <ActivityFeedProvider user={userData.id}>
            <ActivityFeedTab
              entityType={EntityType.USER}
              fqn={decodedUsername}
              isForFeedTab={false}
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
            message: t('server.you-have-not-action-anything-yet', {
              action: t('label.owned-lowercase'),
            }),
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
            message: t('server.you-have-not-action-anything-yet', {
              action: t('label.followed-lowercase'),
            }),
          },
        }),
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
      activeTab,
      userData.id,
      decodedUsername,
      setPreviewAsset,
      tabDataRender,
      disableFields,
    ]
  );

  const handleDescriptionChange = useCallback(
    async (description: string) => {
      await updateUserDetails({ description }, 'description');

      setIsDescriptionEdit(false);
    },
    [updateUserDetails, setIsDescriptionEdit]
  );

  const descriptionRenderComponent = useMemo(
    () =>
      isLoggedInUser ? (
        <DescriptionV1
          description={userData.description ?? ''}
          entityName={getEntityName(userData as unknown as EntityReference)}
          entityType={EntityType.USER}
          hasEditAccess={isLoggedInUser}
          isEdit={isDescriptionEdit}
          showCommentsIcon={false}
          onCancel={() => setIsDescriptionEdit(false)}
          onDescriptionEdit={() => setIsDescriptionEdit(true)}
          onDescriptionUpdate={handleDescriptionChange}
        />
      ) : (
        <Space direction="vertical" size="middle">
          <Typography.Text className="right-panel-label">
            {t('label.description')}
          </Typography.Text>
          <Typography.Paragraph className="m-b-0">
            {isEmpty(userData.description)
              ? t('label.no-entity', {
                  entity: t('label.description'),
                })
              : userData.description}
          </Typography.Paragraph>
        </Space>
      ),
    [
      userData,
      isAdminUser,
      isDescriptionEdit,
      isLoggedInUser,
      getEntityName,
      handleDescriptionChange,
    ]
  );

  const userProfileCollapseHeader = useMemo(
    () => (
      <UserProfileDetails
        afterDeleteAction={afterDeleteAction}
        hasEditPermission={hasEditPermission}
        updateUserDetails={updateUserDetails}
        userData={userData}
      />
    ),
    [userData, afterDeleteAction, updateUserDetails]
  );

  useEffect(() => {
    if ([UserPageTabs.MY_DATA, UserPageTabs.FOLLOWING].includes(activeTab)) {
      fetchAssetsCount(
        activeTab === UserPageTabs.MY_DATA
          ? queryFilters.myData
          : queryFilters.following
      );
    }
  }, [activeTab]);

  return (
    <PageLayoutV1 className="user-layout h-full" pageTitle={t('label.user')}>
      <div data-testid="user-profile">
        <Collapse
          accordion
          bordered={false}
          className="header-collapse-custom-collapse user-profile-container">
          <Collapse.Panel
            className="header-collapse-custom-panel"
            header={userProfileCollapseHeader}
            key="1">
            <Row className="border-top p-y-lg" gutter={[0, 24]}>
              <Col span={24}>
                <Row data-testid="user-profile-accessibility-details">
                  <Col className="p-x-sm border-right" span={6}>
                    <UserProfileTeams
                      isDeletedUser={userData.deleted}
                      teams={userData.teams}
                      updateUserDetails={updateUserDetails}
                    />
                  </Col>
                  <Col className="p-x-sm border-right" span={6}>
                    <UserProfileRoles
                      hasEditPermission={hasEditPermission}
                      isUserAdmin={userData.isAdmin}
                      updateUserDetails={updateUserDetails}
                      userRoles={userData.roles}
                    />
                  </Col>
                  <Col className="p-x-sm border-right" span={6}>
                    <UserProfileInheritedRoles
                      inheritedRoles={userData.inheritedRoles}
                    />
                  </Col>
                  <Col className="p-x-sm" span={6}>
                    <div className="d-flex flex-col justify-between h-full">
                      <Card
                        className="ant-card-feed relative card-body-border-none card-padding-y-0"
                        title={
                          <Typography.Text
                            className="right-panel-label items-center d-flex gap-2"
                            data-testid="persona-list">
                            {t('label.persona')}
                            <PersonaSelectableList
                              multiSelect
                              hasPermission={
                                Boolean(isAdminUser) && !userData.deleted
                              }
                              selectedPersonas={userData.personas ?? []}
                              onUpdate={handlePersonaUpdate}
                            />
                          </Typography.Text>
                        }>
                        <Chip
                          showNoDataPlaceholder
                          data={userData.personas ?? []}
                          entityType={EntityType.PERSONA}
                          icon={<PersonaIcon height={20} />}
                          noDataPlaceholder={t('message.no-persona-assigned')}
                        />
                      </Card>
                    </div>
                  </Col>
                </Row>
              </Col>
              <Col className="border-top p-lg p-b-0" span={24}>
                {descriptionRenderComponent}
              </Col>
            </Row>
          </Collapse.Panel>
        </Collapse>

        <Tabs
          destroyInactiveTabPane
          activeKey={activeTab ?? UserPageTabs.ACTIVITY}
          className="user-page-tabs"
          data-testid="tabs"
          items={tabs}
          onChange={activeTabHandler}
        />
      </div>
    </PageLayoutV1>
  );
};

export default Users;
