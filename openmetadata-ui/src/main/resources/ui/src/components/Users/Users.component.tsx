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

import { Card, Image, Input, Select, Space, Tabs, Typography } from 'antd';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { ReactComponent as IconTeamsGrey } from 'assets/svg/teams-grey.svg';
import { AxiosError } from 'axios';
import ActivityFeedProvider from 'components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from 'components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import EntitySummaryPanel from 'components/Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import InlineEdit from 'components/InlineEdit/InlineEdit.component';
import SearchedData from 'components/searched-data/SearchedData';
import { SearchedDataProps } from 'components/searched-data/SearchedData.interface';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TeamsSelectable from 'components/TeamsSelectable/TeamsSelectable';
import { EntityType } from 'enums/entity.enum';
import { isEmpty, noop, toLower } from 'lodash';
import { observer } from 'mobx-react';
import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { changePassword } from 'rest/auth-API';
import { getRoles } from 'rest/rolesAPIV1';
import { getEntityName } from 'utils/EntityUtils';
import {
  DE_ACTIVE_COLOR,
  getUserPath,
  PAGE_SIZE_LARGE,
  TERM_ADMIN,
} from '../../constants/constants';
import { USER_PROFILE_TABS } from '../../constants/usersprofile.constants';
import { AuthTypes } from '../../enums/signin.enum';
import {
  ChangePasswordRequest,
  RequestType,
} from '../../generated/auth/changePasswordRequest';
import { Role } from '../../generated/entity/teams/role';
import { EntityReference } from '../../generated/entity/teams/user';
import { getNonDeletedTeams } from '../../utils/CommonUtils';
import {
  getImageWithResolutionAndFallback,
  ImageQuality,
} from '../../utils/ProfilerUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useAuthContext } from '../authentication/auth-provider/AuthProvider';
import Description from '../common/description/Description';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import PageLayoutV1 from '../containers/PageLayoutV1';
import Loader from '../Loader/Loader';
import ChangePasswordForm from './ChangePasswordForm';
import { Props, UserPageTabs } from './Users.interface';
import './Users.style.less';
import { userPageFilterList } from './Users.util';

const Users = ({
  userData,
  followingEntities,
  ownedEntities,
  isUserEntitiesLoading,
  updateUserDetails,
  isAdminUser,
  isLoggedinUser,
  isAuthDisabled,
  username,
  onFollowingEntityPaginate,
  onOwnedEntityPaginate,
}: Props) => {
  const { tab = UserPageTabs.ACTIVITY } = useParams<{ tab: UserPageTabs }>();
  const [displayName, setDisplayName] = useState(userData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);
  const [isDescriptionEdit, setIsDescriptionEdit] = useState(false);
  const [isRolesEdit, setIsRolesEdit] = useState(false);
  const [isTeamsEdit, setIsTeamsEdit] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Array<string>>([]);
  const [selectedTeams, setSelectedTeams] = useState<Array<string>>([]);
  const [roles, setRoles] = useState<Array<Role>>([]);
  const history = useHistory();
  const [isImgUrlValid, SetIsImgUrlValid] = useState<boolean>(true);
  const [isChangePassword, setIsChangePassword] = useState<boolean>(false);
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isRolesLoading, setIsRolesLoading] = useState<boolean>(false);

  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [entityDetails, setEntityDetails] =
    useState<SearchedDataProps['data'][number]['_source']>();

  const { authConfig } = useAuthContext();
  const { t } = useTranslation();

  const { isAuthProviderBasic } = useMemo(() => {
    return {
      isAuthProviderBasic:
        authConfig?.provider === AuthTypes.BASIC ||
        authConfig?.provider === AuthTypes.LDAP,
    };
  }, [authConfig]);

  const tabs = useMemo(() => {
    return USER_PROFILE_TABS.map((data) => ({
      label: <TabsLabel id={data.key} key={data.key} name={data.name} />,
      key: data.key,
    }));
  }, []);

  const onDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

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

  const handleDisplayNameChange = () => {
    if (displayName !== userData.displayName) {
      updateUserDetails({ displayName: displayName || '' });
    }
    setIsDisplayNameEdit(false);
  };

  const handleDescriptionChange = async (description: string) => {
    await updateUserDetails({ description });

    setIsDescriptionEdit(false);
  };

  const handleRolesChange = () => {
    // filter out the roles , and exclude the admin one
    const updatedRoles = selectedRoles.filter(
      (roleId) => roleId !== toLower(TERM_ADMIN)
    );

    // get the admin role and send it as boolean value `isAdmin=Boolean(isAdmin)
    const isAdmin = selectedRoles.find(
      (roleId) => roleId === toLower(TERM_ADMIN)
    );
    updateUserDetails({
      roles: updatedRoles.map((roleId) => {
        const role = roles.find((r) => r.id === roleId);

        return { id: roleId, type: 'role', name: role?.name || '' };
      }),
      isAdmin: Boolean(isAdmin),
    });

    setIsRolesEdit(false);
  };
  const handleTeamsChange = () => {
    updateUserDetails({
      teams: selectedTeams.map((teamId) => {
        return { id: teamId, type: 'team' };
      }),
    });

    setIsTeamsEdit(false);
  };

  const handleOnRolesChange = (value: string[]) => {
    setSelectedRoles(value);
  };

  const handleOnTeamsChange = (value: string[]) => {
    setSelectedTeams(value);
  };

  const handleChangePassword = async (data: ChangePasswordRequest) => {
    try {
      setIsLoading(true);
      const sendData = {
        ...data,
        ...(isAdminUser &&
          !isLoggedinUser && {
            username: userData.name,
            requestType: RequestType.User,
          }),
      };
      await changePassword(sendData);
      setIsChangePassword(false);
      showSuccessToast(
        t('server.update-entity-success', { entity: t('label.password') })
      );
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(true);
    }
  };

  const getDisplayNameComponent = () => {
    if (isAdminUser || isLoggedinUser || isAuthDisabled) {
      return (
        <div className="w-full">
          {isDisplayNameEdit ? (
            <InlineEdit
              direction="vertical"
              onCancel={() => setIsDisplayNameEdit(false)}
              onSave={handleDisplayNameChange}>
              <Input
                className="w-full"
                data-testid="displayName"
                id="displayName"
                name="displayName"
                placeholder={t('label.display-name')}
                type="text"
                value={displayName}
                onChange={onDisplayNameChange}
              />
            </InlineEdit>
          ) : (
            <Fragment>
              <span className="tw-text-base tw-font-medium tw-mr-2 tw-overflow-auto">
                {userData.displayName ||
                  t('label.add-entity', { entity: t('label.display-name') })}
              </span>
              <button
                className="tw-ml-2 focus:tw-outline-none"
                data-testid="edit-displayName"
                onClick={() => setIsDisplayNameEdit(true)}>
                <EditIcon color={DE_ACTIVE_COLOR} width={16} />
              </button>
            </Fragment>
          )}
        </div>
      );
    } else {
      return (
        <p className="tw-mt-2">
          {getEntityName(userData as unknown as EntityReference)}
        </p>
      );
    }
  };

  const getDescriptionComponent = () => {
    if (isAdminUser || isLoggedinUser || isAuthDisabled) {
      return (
        <div className="flex items-center justify-between">
          <Description
            description={userData.description || ''}
            entityName={getEntityName(userData as unknown as EntityReference)}
            hasEditAccess={isAdminUser || isLoggedinUser}
            isEdit={isDescriptionEdit}
            onCancel={() => setIsDescriptionEdit(false)}
            onDescriptionEdit={() => setIsDescriptionEdit(true)}
            onDescriptionUpdate={handleDescriptionChange}
          />
        </div>
      );
    } else {
      return (
        <div className="p-x-sm">
          <p className="m-t-xs">
            {userData.description || (
              <span className="text-grey-muted">
                {t('label.no-entity', {
                  entity: t('label.description'),
                })}
              </span>
            )}
          </p>
        </div>
      );
    }
  };

  const getChangePasswordComponent = () => {
    return (
      <div>
        <Typography.Text
          className="text-primary text-xs cursor-pointer"
          onClick={() => setIsChangePassword(true)}>
          {t('label.change-entity', { entity: t('label.password-lowercase') })}
        </Typography.Text>

        <ChangePasswordForm
          isLoading={isLoading}
          isLoggedinUser={isLoggedinUser}
          visible={isChangePassword}
          onCancel={() => setIsChangePassword(false)}
          onSave={(data) => handleChangePassword(data)}
        />
      </div>
    );
  };

  const getTeamsComponent = () => {
    const teamsElement = (
      <Fragment>
        {getNonDeletedTeams(userData.teams ?? []).map((team, i) => (
          <div
            className="tw-mb-2 d-flex tw-items-center tw-gap-2"
            data-testid={team.name}
            key={i}>
            <IconTeamsGrey height={16} width={16} />
            <Typography.Text
              className="ant-typography-ellipsis-custom w-48"
              ellipsis={{ tooltip: true }}>
              {getEntityName(team)}
            </Typography.Text>
          </div>
        ))}
        {isEmpty(userData.teams) && (
          <span className="text-grey-muted ">{t('message.no-team-found')}</span>
        )}
      </Fragment>
    );

    if (!isAdminUser && !isAuthDisabled) {
      return (
        <Card
          className="ant-card-feed relative card-body-border-none card-padding-y-0"
          key="teams-card"
          style={{
            marginTop: '20px',
          }}
          title={
            <div className="d-flex tw-items-center tw-justify-between">
              <h6 className="right-panel-label tw-mb-0">
                {t('label.team-plural')}
              </h6>
            </div>
          }>
          <div className="tw-mb-4">{teamsElement}</div>
        </Card>
      );
    } else {
      return (
        <Card
          className="ant-card-feed relative card-body-border-none card-padding-y-0"
          key="teams-card"
          style={{
            marginTop: '20px',
          }}
          title={
            <div className="d-flex tw-items-center tw-justify-between">
              <h6 className="right-panel-label tw-mb-0">
                {t('label.team-plural')}
              </h6>
              {!isTeamsEdit && (
                <button
                  className="tw-ml-2 focus:tw-outline-none "
                  data-testid="edit-teams"
                  onClick={() => setIsTeamsEdit(true)}>
                  <EditIcon color={DE_ACTIVE_COLOR} width={16} />
                </button>
              )}
            </div>
          }>
          <div className="tw-mb-4">
            {isTeamsEdit ? (
              <InlineEdit
                direction="vertical"
                onCancel={() => setIsTeamsEdit(false)}
                onSave={handleTeamsChange}>
                <TeamsSelectable
                  filterJoinable
                  selectedTeams={selectedTeams}
                  onSelectionChange={handleOnTeamsChange}
                />
              </InlineEdit>
            ) : (
              teamsElement
            )}
          </div>
        </Card>
      );
    }
  };

  const getRolesComponent = () => {
    const userRolesOption = roles?.map((role) => ({
      label: getEntityName(role as unknown as EntityReference),
      value: role.id,
    }));
    if (!userData.isAdmin) {
      userRolesOption.push({
        label: TERM_ADMIN,
        value: toLower(TERM_ADMIN),
      });
    }

    const rolesElement = (
      <Fragment>
        {userData.isAdmin && (
          <div className="tw-mb-2 d-flex tw-items-center tw-gap-2">
            <SVGIcons alt="icon" className="tw-w-4" icon={Icons.USERS} />
            <span>{TERM_ADMIN}</span>
          </div>
        )}
        {userData.roles?.map((role, i) => (
          <div className="tw-mb-2 d-flex tw-items-center tw-gap-2" key={i}>
            <SVGIcons alt="icon" className="tw-w-4" icon={Icons.USERS} />
            <Typography.Text
              className="ant-typography-ellipsis-custom w-48"
              ellipsis={{ tooltip: true }}>
              {getEntityName(role)}
            </Typography.Text>
          </div>
        ))}
        {!userData.isAdmin && isEmpty(userData.roles) && (
          <span className="text-grey-muted ">
            {t('message.no-roles-assigned')}
          </span>
        )}
      </Fragment>
    );

    if (!isAdminUser && !isAuthDisabled) {
      return (
        <Card
          className="ant-card-feed relative card-body-border-none card-padding-y-0"
          key="roles-card "
          style={{
            marginTop: '20px',
          }}
          title={
            <div className="d-flex tw-items-center tw-justify-between">
              <h6 className="right-panel-label tw-mb-0">
                {t('label.role-plural')}
              </h6>
            </div>
          }>
          <div className="roles-container">{rolesElement}</div>
        </Card>
      );
    } else {
      return (
        <Card
          className="ant-card-feed relative card-body-border-none card-padding-y-0"
          key="roles-card"
          style={{
            marginTop: '20px',
          }}
          title={
            <div className="d-flex tw-items-center tw-justify-between">
              <h6 className="right-panel-label tw-mb-0">
                {t('label.role-plural')}
              </h6>
              {!isRolesEdit && (
                <button
                  className="tw-ml-2 focus:tw-outline-none"
                  data-testid="edit-roles"
                  onClick={() => setIsRolesEdit(true)}>
                  <EditIcon color={DE_ACTIVE_COLOR} width={16} />
                </button>
              )}
            </div>
          }>
          <div className="tw-mb-4">
            {isRolesEdit ? (
              <InlineEdit
                direction="vertical"
                onCancel={() => setIsRolesEdit(false)}
                onSave={handleRolesChange}>
                <Select
                  allowClear
                  showSearch
                  aria-label="Select roles"
                  className="w-full"
                  id="select-role"
                  loading={isRolesLoading}
                  mode="multiple"
                  options={userRolesOption}
                  placeholder={t('label.role-plural')}
                  value={!isRolesLoading ? selectedRoles : []}
                  onChange={handleOnRolesChange}
                />
              </InlineEdit>
            ) : (
              rolesElement
            )}
          </div>
        </Card>
      );
    }
  };

  const getInheritedRolesComponent = () => {
    return (
      <Card
        className="ant-card-feed relative card-body-border-none card-padding-y-0"
        key="inherited-roles-card-component"
        style={{
          marginTop: '20px',
        }}
        title={
          <div className="d-flex">
            <h6
              className="right-panel-label tw-mb-0"
              data-testid="inherited-roles">
              {t('label.inherited-role-plural')}
            </h6>
          </div>
        }>
        <Fragment>
          {isEmpty(userData.inheritedRoles) ? (
            <div className="tw-mb-4">
              <span className="text-grey-muted">
                {t('message.no-inherited-roles-found')}
              </span>
            </div>
          ) : (
            <div className="d-flex tw-justify-between flex-col">
              {userData.inheritedRoles?.map((inheritedRole, i) => (
                <div
                  className="tw-mb-2 d-flex tw-items-center tw-gap-2"
                  key={i}>
                  <SVGIcons alt="icon" className="tw-w-4" icon={Icons.USERS} />

                  <Typography.Text
                    className="ant-typography-ellipsis-custom w-48"
                    ellipsis={{ tooltip: true }}>
                    {getEntityName(inheritedRole)}
                  </Typography.Text>
                </div>
              ))}
            </div>
          )}
        </Fragment>
      </Card>
    );
  };

  const image = useMemo(
    () =>
      getImageWithResolutionAndFallback(
        ImageQuality['6x'],
        userData.profile?.images
      ),
    [userData.profile?.images]
  );

  const fetchLeftPanel = () => {
    return (
      <div className="p-xs user-profile-antd-card" data-testid="left-panel">
        <Card className="ant-card-feed relative" key="left-panel-card">
          {isImgUrlValid ? (
            <Image
              alt="profile"
              className="tw-w-full"
              preview={false}
              referrerPolicy="no-referrer"
              src={image || ''}
              onError={() => {
                SetIsImgUrlValid(false);
              }}
            />
          ) : (
            <div style={{ width: 'inherit' }}>
              <ProfilePicture
                displayName={userData?.displayName || userData.name}
                height="150"
                id={userData?.id || ''}
                name={userData?.name || ''}
                textClass="tw-text-5xl"
                width=""
              />
            </div>
          )}
          <Space className="p-sm w-full" direction="vertical" size={8}>
            {getDisplayNameComponent()}
            <p>{userData.email}</p>
            {getDescriptionComponent()}
            {isAuthProviderBasic &&
              (isAdminUser || isLoggedinUser) &&
              getChangePasswordComponent()}
          </Space>
        </Card>
        {getTeamsComponent()}
        {getRolesComponent()}
        {getInheritedRolesComponent()}
      </div>
    );
  };

  const prepareSelectedRoles = () => {
    const defaultRoles = [...(userData.roles?.map((role) => role.id) || [])];
    if (userData.isAdmin) {
      defaultRoles.push(toLower(TERM_ADMIN));
    }
    setSelectedRoles(defaultRoles);
  };

  const prepareSelectedTeams = () => {
    setSelectedTeams(
      getNonDeletedTeams(userData.teams || []).map((team) => team.id)
    );
  };

  const fetchRoles = async () => {
    setIsRolesLoading(true);
    try {
      const response = await getRoles(
        '',
        undefined,
        undefined,
        false,
        PAGE_SIZE_LARGE
      );
      setRoles(response.data);
    } catch (err) {
      setRoles([]);
      showErrorToast(
        err as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.role-plural'),
        })
      );
    } finally {
      setIsRolesLoading(false);
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

  useEffect(() => {
    prepareSelectedRoles();
    prepareSelectedTeams();
  }, [userData]);

  useEffect(() => {
    if (image) {
      SetIsImgUrlValid(true);
    }
  }, [image]);

  useEffect(() => {
    if (isRolesEdit && isEmpty(roles)) {
      fetchRoles();
    }
  }, [isRolesEdit, roles]);

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
          <PageLayoutV1
            className="user-page-layout"
            pageTitle={t('label.user')}
            rightPanel={
              showSummaryPanel &&
              entityDetails && (
                <EntitySummaryPanel
                  entityDetails={{ details: entityDetails }}
                  handleClosePanel={handleClosePanel}
                />
              )
            }
            rightPanelWidth={400}>
            {entityData.data.length ? (
              <SearchedData
                currentPage={entityData.currPage}
                data={entityData.data ?? []}
                handleSummaryPanelDisplay={handleSummaryPanelDisplay}
                isFilterSelected={false}
                isSummaryPanelVisible={showSummaryPanel}
                selectedEntityId={entityDetails?.id || ''}
                totalValue={entityData.total ?? 0}
                onPaginationChange={
                  tab === UserPageTabs.MY_DATA
                    ? onOwnedEntityPaginate
                    : onFollowingEntityPaginate
                }
              />
            ) : (
              <ErrorPlaceHolder>
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
          </PageLayoutV1>
        );
      }
      case UserPageTabs.ACTIVITY:
        return (
          <ActivityFeedProvider user={userData.id}>
            <ActivityFeedTab
              entityType={EntityType.USER_NAME}
              fqn={username}
              onFeedUpdate={noop}
            />
          </ActivityFeedProvider>
        );

      default:
        return <></>;
    }
  }, [
    tab,
    followingEntities,
    ownedEntities,
    isUserEntitiesLoading,
    userPageFilterList,
    entityDetails,
  ]);

  return (
    <PageLayoutV1
      className="user-layout h-full"
      leftPanel={fetchLeftPanel()}
      pageTitle={t('label.user')}>
      <div data-testid="table-container">
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
