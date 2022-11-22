/*
 *  Copyright 2021 Collate
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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Card, Input, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isArray, isEmpty, isNil, toLower } from 'lodash';
import React, { FC, Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createBotWithPut } from '../../axiosAPIs/botsAPI';
import {
  createUserWithPut,
  getAuthMechanismForBotUser,
  getRoles,
} from '../../axiosAPIs/userAPI';
import { PAGE_SIZE_LARGE, TERM_ADMIN } from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/globalSettings.constants';
import { EntityType } from '../../enums/entity.enum';
import { Role } from '../../generated/entity/teams/role';
import {
  AuthenticationMechanism,
  AuthType,
} from '../../generated/entity/teams/user';
import { getEntityName } from '../../utils/CommonUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Description from '../common/description/Description';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import PageLayout from '../containers/PageLayout';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import AuthMechanism from './AuthMechanism';
import AuthMechanismForm from './AuthMechanismForm';
import {
  BotsDetailProps,
  DescriptionComponentProps,
  DisplayNameComponentProps,
  InheritedRolesComponentProps,
  RolesComponentProps,
  RolesElementProps,
} from './BotDetails.interfaces';
import './BotDetails.style.less';

const BotDetails: FC<BotsDetailProps> = ({
  botData,
  botUserData,
  updateBotsDetails,
  revokeTokenHandler,
  botPermission,
  onEmailChange,
  isAdminUser,
  isAuthDisabled,
  updateUserDetails,
}) => {
  const [displayName, setDisplayName] = useState(botData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);
  const [isDescriptionEdit, setIsDescriptionEdit] = useState(false);
  const [isRevokingToken, setIsRevokingToken] = useState<boolean>(false);
  const [isRolesEdit, setIsRolesEdit] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Array<string>>([]);
  const [roles, setRoles] = useState<Array<Role>>([]);

  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const { t } = useTranslation();
  const [authenticationMechanism, setAuthenticationMechanism] =
    useState<AuthenticationMechanism>();

  const [isAuthMechanismEdit, setIsAuthMechanismEdit] =
    useState<boolean>(false);

  const editAllPermission = useMemo(
    () => botPermission.EditAll,
    [botPermission]
  );
  const displayNamePermission = useMemo(
    () => botPermission.EditDisplayName,
    [botPermission]
  );

  const descriptionPermission = useMemo(
    () => botPermission.EditDescription,
    [botPermission]
  );

  const fetchAuthMechanismForBot = async () => {
    try {
      const response = await getAuthMechanismForBotUser(botUserData.id);
      setAuthenticationMechanism(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await getRoles(
        '',
        undefined,
        undefined,
        false,
        PAGE_SIZE_LARGE
      );
      setRoles(response.data.data);
    } catch (err) {
      setRoles([]);
      showErrorToast(err as AxiosError);
    }
  };

  const handleAuthMechanismUpdate = async (
    updatedAuthMechanism: AuthenticationMechanism
  ) => {
    setIsUpdating(true);
    try {
      const {
        isAdmin,
        timezone,
        name,
        description,
        displayName,
        profile,
        email,
        isBot,
      } = botUserData;
      const response = await createUserWithPut({
        isAdmin,
        timezone,
        name,
        description,
        displayName,
        profile,
        email,
        isBot,
        authenticationMechanism: {
          ...botUserData.authenticationMechanism,
          authType: updatedAuthMechanism.authType,
          config:
            updatedAuthMechanism.authType === AuthType.Jwt
              ? {
                  JWTTokenExpiry: updatedAuthMechanism.config?.JWTTokenExpiry,
                }
              : {
                  ssoServiceType: updatedAuthMechanism.config?.ssoServiceType,
                  authConfig: updatedAuthMechanism.config?.authConfig,
                },
        },
        botName: botData.name,
      });
      if (response) {
        await createBotWithPut({
          name: botData.name,
          description: botData.description,
          displayName: botData.displayName,
          botUser: { id: response.id, type: EntityType.USER },
        });
        fetchAuthMechanismForBot();
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
      setIsAuthMechanismEdit(false);
    }
  };

  const handleAuthMechanismEdit = () => setIsAuthMechanismEdit(true);

  const onDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

  const handleDisplayNameChange = () => {
    if (displayName !== botData.displayName) {
      updateBotsDetails({ displayName: displayName || '' });
    }
    setIsDisplayNameEdit(false);
  };

  const handleDescriptionChange = async (description: string) => {
    await updateBotsDetails({ description });

    setIsDescriptionEdit(false);
  };

  const DisplayNameComponent = ({
    isDisplayNameEdit,
    displayName,
    onDisplayNameChange,
    handleDisplayNameChange,
    displayNamePermission,
    editAllPermission,
    setIsDisplayNameEdit,
  }: DisplayNameComponentProps) => {
    return (
      <div className="mt-4 w-full flex">
        {isDisplayNameEdit ? (
          <div className="flex items-center gap-2">
            <Input
              className="w-full"
              data-testid="displayName"
              id="displayName"
              name={t('label.displayName')}
              placeholder={t('label.displayName')}
              value={displayName}
              onChange={onDisplayNameChange}
            />
            <div
              className="flex justify-end bot-details-buttons"
              data-testid="buttons">
              <Button
                className="text-sm mr-1"
                data-testid="cancel-displayName"
                icon={<FontAwesomeIcon className="w-3.5 h-3.5" icon="times" />}
                type="primary"
                onMouseDown={() => setIsDisplayNameEdit(false)}
              />

              <Button
                className="text-sm mr-1"
                data-testid="save-displayName"
                icon={<FontAwesomeIcon className="w-3.5 h-3.5" icon="check" />}
                type="primary"
                onClick={handleDisplayNameChange}
              />
            </div>
          </div>
        ) : (
          <Fragment>
            {displayName ? (
              <Typography.Title className="display-name" level={5}>
                {displayName}
              </Typography.Title>
            ) : (
              <Typography.Text className="no-description">
                {t('label.add-display-name')}
              </Typography.Text>
            )}
            {(displayNamePermission || editAllPermission) && (
              <button
                className="tw-ml-2 focus:tw-outline-none"
                data-testid="edit-displayName"
                onClick={() => setIsDisplayNameEdit(true)}>
                <SVGIcons
                  alt="edit"
                  icon="icon-edit"
                  title={t('label.edit')}
                  width="16px"
                />
              </button>
            )}
          </Fragment>
        )}
      </div>
    );
  };

  const DescriptionComponent = ({ botData }: DescriptionComponentProps) => {
    return (
      <Description
        description={botData.description || ''}
        entityName={getEntityName(botData)}
        hasEditAccess={descriptionPermission || editAllPermission}
        isEdit={isDescriptionEdit}
        onCancel={() => setIsDescriptionEdit(false)}
        onDescriptionEdit={() => setIsDescriptionEdit(true)}
        onDescriptionUpdate={handleDescriptionChange}
      />
    );
  };

  const prepareSelectedRoles = () => {
    const defaultRoles = [...(botUserData.roles?.map((role) => role.id) || [])];
    if (botUserData.isAdmin) {
      defaultRoles.push(toLower(TERM_ADMIN));
    }
    setSelectedRoles(defaultRoles);
  };

  const handleRolesChange = () => {
    // filter out the roles , and exclude the admin one
    const updatedRoles = isArray(selectedRoles)
      ? selectedRoles.filter((roleId) => roleId !== toLower(TERM_ADMIN))
      : [];
    // get the admin role and send it as boolean value `isAdmin=Boolean(isAdmin)
    const isAdmin = isArray(selectedRoles)
      ? selectedRoles.find((roleId) => roleId === toLower(TERM_ADMIN))
      : [];

    updateUserDetails({
      roles: updatedRoles.map((roleId) => {
        const role = roles.find((r) => r.id === roleId);

        return { id: roleId, type: 'role', name: role?.name || '' };
      }),
      isAdmin: Boolean(isAdmin),
    });

    setIsRolesEdit(false);
  };

  const handleOnRolesChange = (selectedOptions: string[]) => {
    if (isNil(selectedOptions)) {
      setSelectedRoles([]);
    } else {
      setSelectedRoles(selectedOptions);
    }
  };

  const RolesElement = ({ botUserData }: RolesElementProps) => (
    <Fragment>
      {botUserData.isAdmin && (
        <div className="mb-2 flex items-center gap-2">
          <SVGIcons alt="icon" className="w-4" icon={Icons.USERS} />
          <span>{TERM_ADMIN}</span>
        </div>
      )}
      {botUserData?.roles?.map((role, i) => (
        <div className="mb-2 flex items-center gap-2" key={i}>
          <SVGIcons alt="icon" className="w-4" icon={Icons.USERS} />
          <Typography.Text
            className="ant-typography-ellipsis-custom w-48"
            ellipsis={{ tooltip: true }}>
            {getEntityName(role)}
          </Typography.Text>
        </div>
      ))}
      {!botUserData.isAdmin && isEmpty(botUserData.roles) && (
        <span className="no-description ">{t('label.no-roles-assigned')}</span>
      )}
    </Fragment>
  );

  const RolesComponent = ({ roles, botUserData }: RolesComponentProps) => {
    const userRolesOption = isArray(roles)
      ? roles.map((role) => ({
          label: getEntityName(role),
          value: role.id,
        }))
      : [];

    if (!botUserData.isAdmin) {
      userRolesOption.push({
        label: TERM_ADMIN,
        value: toLower(TERM_ADMIN),
      });
    }

    if (isAdminUser && !isAuthDisabled) {
      return (
        <Card
          className="ant-card-feed relative bot-details-card mt-2.5"
          key="roles-card"
          title={
            <div className="flex items-center justify-between">
              <h6 className="mb-0">{t('label.roles')}</h6>
              {!isRolesEdit && (
                <button
                  className="m-l-xs focus:tw-outline-none tw-self-baseline"
                  data-testid="edit-roles"
                  onClick={() => setIsRolesEdit(true)}>
                  <SVGIcons
                    alt="edit"
                    className="m-b-xss"
                    icon="icon-edit"
                    title="Edit"
                    width="16px"
                  />
                </button>
              )}
            </div>
          }>
          <div className="mb-4">
            {isRolesEdit ? (
              <Space className="w-full" direction="vertical">
                <Select
                  aria-label="Select roles"
                  className="w-full"
                  defaultValue={selectedRoles}
                  id="select-role"
                  mode="multiple"
                  options={userRolesOption}
                  placeholder={`${t('label.roles')}...`}
                  onChange={handleOnRolesChange}
                />
                <div
                  className="flex justify-end bot-details-buttons"
                  data-testid="buttons">
                  <Button
                    className="text-sm mr-1"
                    data-testid="cancel-roles"
                    icon={
                      <FontAwesomeIcon className="w-3.5 h-3.5" icon="times" />
                    }
                    type="primary"
                    onMouseDown={() => setIsRolesEdit(false)}
                  />
                  <Button
                    className="text-sm"
                    data-testid="save-roles"
                    icon={
                      <FontAwesomeIcon className="w-3.5 h-3.5" icon="check" />
                    }
                    type="primary"
                    onClick={handleRolesChange}
                  />
                </div>
              </Space>
            ) : (
              <RolesElement botUserData={botUserData} />
            )}
          </div>
        </Card>
      );
    } else {
      return (
        <Card
          className="ant-card-feed relative bot-details-card mt-2.5"
          key="roles-card"
          title={
            <div className="flex items-center justify-between">
              <h6 className="mb-0">{t('label.roles')}</h6>
            </div>
          }>
          <div className="flex items-center justify-between mb-4">
            <RolesElement botUserData={botUserData} />
          </div>
        </Card>
      );
    }
  };

  const InheritedRolesComponent = ({
    botUserData,
  }: InheritedRolesComponentProps) => (
    <Card
      className="ant-card-feed relative bot-details-card mt-2.5"
      key="inherited-roles-card-component"
      title={
        <div className="flex">
          <h6 className="heading mb-0" data-testid="inherited-roles">
            {t('label.inherited-roles')}
          </h6>
        </div>
      }>
      <Fragment>
        {isEmpty(botUserData.inheritedRoles) ? (
          <div className="mb-4">
            <span className="no-description">
              {t('label.no-inherited-found')}
            </span>
          </div>
        ) : (
          <div className="flex justify-between flex-col">
            {botUserData.inheritedRoles?.map((inheritedRole, i) => (
              <div className="mb-2 flex items-center gap-2" key={i}>
                <SVGIcons alt="icon" className="w-4" icon={Icons.USERS} />

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

  const fetchLeftPanel = () => {
    return (
      <>
        <Card className="ant-card-feed bot-details-card mt-2">
          <div data-testid="left-panel">
            <div className="flex flex-col">
              <SVGIcons
                alt="bot-profile"
                icon={Icons.BOT_PROFILE}
                width="280px"
              />

              <Space className="p-b-md" direction="vertical" size={8}>
                <DisplayNameComponent
                  displayName={displayName}
                  displayNamePermission={displayNamePermission}
                  editAllPermission={editAllPermission}
                  handleDisplayNameChange={handleDisplayNameChange}
                  isDisplayNameEdit={isDisplayNameEdit}
                  setIsDisplayNameEdit={(value: boolean) =>
                    setIsDisplayNameEdit(value)
                  }
                  onDisplayNameChange={onDisplayNameChange}
                />
                <DescriptionComponent botData={botData} />
              </Space>
            </div>
          </div>
        </Card>
        <RolesComponent botUserData={botUserData} roles={roles} />
        <InheritedRolesComponent botUserData={botUserData} />
      </>
    );
  };

  const rightPanel = (
    <Card className="ant-card-feed bot-details-card mt-2">
      <div data-testid="right-panel">
        <div className="flex flex-col">
          <Typography.Text className="mb-2 text-lg">
            {t('label.token-security')}
          </Typography.Text>
          <Typography.Text className="mb-2">
            {t('message.token-security-description')}
          </Typography.Text>
        </div>
      </div>
    </Card>
  );

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    prepareSelectedRoles();
    if (botUserData.id) {
      fetchAuthMechanismForBot();
    }
  }, [botUserData]);

  return (
    <PageLayout
      classes="tw-h-full tw-px-4"
      header={
        <TitleBreadcrumb
          className="tw-px-6"
          titleLinks={[
            {
              name: 'Bots',
              url: getSettingPath(
                GlobalSettingsMenuCategory.INTEGRATIONS,
                GlobalSettingOptions.BOTS
              ),
            },
            { name: botData.name || '', url: '', activeTitle: true },
          ]}
        />
      }
      leftPanel={fetchLeftPanel()}
      rightPanel={rightPanel}>
      <Card data-testid="center-panel bot-details-card mt-2">
        {authenticationMechanism ? (
          <>
            {isAuthMechanismEdit ? (
              <AuthMechanismForm
                authenticationMechanism={authenticationMechanism}
                botData={botData}
                botUser={botUserData}
                isUpdating={isUpdating}
                onCancel={() => setIsAuthMechanismEdit(false)}
                onEmailChange={onEmailChange}
                onSave={handleAuthMechanismUpdate}
              />
            ) : (
              <AuthMechanism
                authenticationMechanism={authenticationMechanism}
                botUser={botUserData}
                hasPermission={editAllPermission}
                onEdit={handleAuthMechanismEdit}
                onTokenRevoke={() => setIsRevokingToken(true)}
              />
            )}
          </>
        ) : (
          <AuthMechanismForm
            authenticationMechanism={{} as AuthenticationMechanism}
            botData={botData}
            botUser={botUserData}
            isUpdating={isUpdating}
            onCancel={() => setIsAuthMechanismEdit(false)}
            onEmailChange={onEmailChange}
            onSave={handleAuthMechanismUpdate}
          />
        )}
      </Card>

      {isRevokingToken ? (
        <ConfirmationModal
          bodyText="Are you sure you want to revoke access for JWT token?"
          cancelText="Cancel"
          confirmText="Confirm"
          header="Are you sure?"
          onCancel={() => setIsRevokingToken(false)}
          onConfirm={() => {
            revokeTokenHandler();
            setIsRevokingToken(false);
            handleAuthMechanismEdit();
          }}
        />
      ) : null}
    </PageLayout>
  );
};

export default BotDetails;
