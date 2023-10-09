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

import { Col, Row, Tabs, Typography } from 'antd';
import Card from 'antd/lib/card/Card';
import { isEmpty, noop } from 'lodash';
import { observer } from 'mobx-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { ReactComponent as PersonaIcon } from '../../assets/svg/ic-personas.svg';
import ActivityFeedProvider from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import EntitySummaryPanel from '../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import SearchedData from '../../components/searched-data/SearchedData';
import { SearchedDataProps } from '../../components/searched-data/SearchedData.interface';
import TabsLabel from '../../components/TabsLabel/TabsLabel.component';
import { getUserPath, NO_DATA_PLACEHOLDER } from '../../constants/constants';
import { USER_PROFILE_TABS } from '../../constants/usersprofile.constants';
import { EntityType } from '../../enums/entity.enum';
import { EntityReference } from '../../generated/entity/type';
import Chip from '../common/Chip/Chip.component';
import PageLayoutV1 from '../containers/PageLayoutV1';
import Loader from '../Loader/Loader';
import { PersonaSelectableList } from '../Persona/PersonaSelectableList/PersonaSelectableList.component';
import { Props, UserPageTabs } from './Users.interface';
import './Users.style.less';
import UserProfileDetails from './UsersProfile/UserProfileDetails/UserProfileDetails.component';
import UserProfileImage from './UsersProfile/UserProfileImage/UserProfileImage.component';
import UserProfileInheritedRoles from './UsersProfile/UserProfileInheritedRoles/UserProfileInheritedRoles.component';
import UserProfileRoles from './UsersProfile/UserProfileRoles/UserProfileRoles.component';
import UserProfileTeams from './UsersProfile/UserProfileTeams/UserProfileTeams.component';

const Users = ({
  userData,
  followingEntities,
  ownedEntities,
  isUserEntitiesLoading,
  updateUserDetails,
  username,
  handlePaginate,
}: Props) => {
  const { tab = UserPageTabs.ACTIVITY } = useParams<{ tab: UserPageTabs }>();

  const history = useHistory();
  const location = useLocation();

  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [entityDetails, setEntityDetails] =
    useState<SearchedDataProps['data'][number]['_source']>();

  const { t } = useTranslation();

  const tabs = useMemo(() => {
    return USER_PROFILE_TABS.map((data) => ({
      label: <TabsLabel id={data.key} key={data.key} name={data.name} />,
      key: data.key,
    }));
  }, []);

  const activeTabHandler = (activeKey: string) => {
    // To reset search params appends from other page for proper navigation
    location.search = '';
    if (activeKey !== tab) {
      history.push({
        pathname: getUserPath(username, activeKey),
        search: location.search,
      });
    }
  };

  const handleSummaryPanelDisplay = useCallback(
    (details: SearchedDataProps['data'][number]['_source']) => {
      setShowSummaryPanel(true);
      setEntityDetails(details);
    },
    []
  );

  const handleClosePanel = () => {
    setShowSummaryPanel(false);
  };

  useEffect(() => {
    if ([UserPageTabs.FOLLOWING, UserPageTabs.MY_DATA].includes(tab)) {
      const entityData =
        tab === UserPageTabs.MY_DATA ? ownedEntities : followingEntities;

      if (!isEmpty(entityData.data) && entityData.data[0]) {
        handleSummaryPanelDisplay(entityData.data[0]?._source);
      } else {
        setShowSummaryPanel(false);
        setEntityDetails(undefined);
      }
    }
  }, [tab, ownedEntities, followingEntities]);

  const activityFeed = useMemo(
    () => (
      <ActivityFeedProvider user={userData.id}>
        <ActivityFeedTab
          entityType={EntityType.USER}
          fqn={username}
          onFeedUpdate={noop}
        />
      </ActivityFeedProvider>
    ),
    [userData, username]
  );

  const handlePersonaUpdate = useCallback(
    async (personas: EntityReference[]) => {
      await updateUserDetails({ ...userData, personas });
    },
    [updateUserDetails, userData]
  );

  const handleDefaultPersonaUpdate = useCallback(
    async (defaultPersona?: EntityReference) => {
      await updateUserDetails({ ...userData, defaultPersona });
    },
    [updateUserDetails, userData]
  );

  const tabDetails = useMemo(() => {
    switch (tab) {
      case UserPageTabs.FOLLOWING:
      case UserPageTabs.MY_DATA: {
        const entityData =
          tab === UserPageTabs.MY_DATA ? ownedEntities : followingEntities;
        if (isUserEntitiesLoading) {
          return <Loader />;
        }

        return (
          <Row className="user-page-layout" wrap={false}>
            <Col className="user-layout-scroll" flex="auto">
              {entityData.data.length ? (
                <SearchedData
                  data={entityData.data ?? []}
                  handleSummaryPanelDisplay={handleSummaryPanelDisplay}
                  isFilterSelected={false}
                  isSummaryPanelVisible={showSummaryPanel}
                  selectedEntityId={entityDetails?.id || ''}
                  totalValue={entityData.total ?? 0}
                  onPaginationChange={handlePaginate}
                />
              ) : (
                <ErrorPlaceHolder className="m-0">
                  <Typography.Paragraph>
                    {tab === UserPageTabs.MY_DATA
                      ? t('server.you-have-not-action-anything-yet', {
                          action: t('label.owned-lowercase'),
                        })
                      : t('server.you-have-not-action-anything-yet', {
                          action: t('label.followed-lowercase'),
                        })}
                  </Typography.Paragraph>
                </ErrorPlaceHolder>
              )}
            </Col>

            {showSummaryPanel && entityDetails && (
              <Col className="user-page-layout-right-panel " flex="400px">
                <EntitySummaryPanel
                  entityDetails={{ details: entityDetails }}
                  handleClosePanel={handleClosePanel}
                />
              </Col>
            )}
          </Row>
        );
      }
      case UserPageTabs.ACTIVITY:
        return activityFeed;

      default:
        return <></>;
    }
  }, [
    tab,
    followingEntities,
    ownedEntities,
    isUserEntitiesLoading,
    entityDetails,
    activityFeed,
  ]);

  return (
    <PageLayoutV1 className="user-layout h-full" pageTitle={t('label.user')}>
      <div data-testid="table-container">
        <Row className="user-profile-container" data-testid="user-profile">
          <Col className="flex-center border-right" span={4}>
            <UserProfileImage
              userData={{
                id: userData.id,
                name: userData.name,
                displayName: userData.displayName,
                images: userData.profile?.images,
              }}
            />
          </Col>
          <Col className="p-x-sm border-right" span={5}>
            <UserProfileDetails
              updateUserDetails={updateUserDetails}
              userData={{
                email: userData.email,
                name: userData.name,
                displayName: userData.displayName,
                description: userData.description,
              }}
            />
          </Col>
          <Col className="p-x-sm border-right" span={5}>
            <UserProfileTeams
              teams={userData.teams}
              updateUserDetails={updateUserDetails}
            />
          </Col>
          <Col className="p-x-sm border-right" span={5}>
            <div className="d-flex flex-col justify-between h-full">
              <UserProfileRoles
                isUserAdmin={userData.isAdmin}
                updateUserDetails={updateUserDetails}
                userRoles={userData.roles}
              />
              <UserProfileInheritedRoles
                inheritedRoles={userData.inheritedRoles}
              />
            </div>
          </Col>
          <Col className="p-x-sm border-right" span={5}>
            <div className="d-flex flex-col justify-between h-full">
              <Card
                className="ant-card-feed relative card-body-border-none card-padding-y-0 m-b-md"
                title={
                  <Typography.Text
                    className="right-panel-label items-center d-flex gap-2"
                    data-testid="inherited-roles">
                    {t('label.persona')}
                    <PersonaSelectableList
                      hasPermission
                      multiSelect
                      selectedPersonas={userData.personas ?? []}
                      onUpdate={handlePersonaUpdate}
                    />
                  </Typography.Text>
                }>
                <Chip
                  showNoDataPlaceholder
                  data={userData.personas ?? []}
                  icon={<PersonaIcon height={18} />}
                  noDataPlaceholder={t('message.no-persona-assigned')}
                />
              </Card>
              <Card
                className="ant-card-feed relative card-body-border-none card-padding-y-0"
                title={
                  <Typography.Text
                    className="right-panel-label m-b-0 d-flex gap-2"
                    data-testid="inherited-roles">
                    {t('label.default-persona')}
                    <PersonaSelectableList
                      hasPermission
                      multiSelect={false}
                      personaList={userData.personas}
                      selectedPersonas={
                        userData.defaultPersona ? [userData.defaultPersona] : []
                      }
                      onUpdate={handleDefaultPersonaUpdate}
                    />
                  </Typography.Text>
                }>
                <Chip
                  showNoDataPlaceholder
                  data={
                    userData.defaultPersona ? [userData.defaultPersona] : []
                  }
                  icon={<PersonaIcon height={18} />}
                  noDataPlaceholder={NO_DATA_PLACEHOLDER}
                />
              </Card>
            </div>
          </Col>
        </Row>
        <Tabs
          activeKey={tab ?? UserPageTabs.ACTIVITY}
          className="user-page-tabs"
          data-testid="tabs"
          items={tabs}
          onChange={activeTabHandler}
        />
        <div>{tabDetails}</div>
      </div>
    </PageLayoutV1>
  );
};

export default observer(Users);
