/*
 *  Copyright 2023 Collate.
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

import { Button, Divider, Input, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../../assets/svg/edit-new.svg';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
  NO_DATA_PLACEHOLDER,
} from '../../../../../constants/constants';
import { EntityType } from '../../../../../enums/entity.enum';
import {
  ChangePasswordRequest,
  RequestType,
} from '../../../../../generated/auth/changePasswordRequest';
import { EntityReference } from '../../../../../generated/entity/type';
import { AuthProvider } from '../../../../../generated/settings/settings';
import { useAuth } from '../../../../../hooks/authHooks';
import { useFqn } from '../../../../../hooks/useFqn';
import { changePassword } from '../../../../../rest/auth-API';
import { getEntityName } from '../../../../../utils/EntityUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import { useAuthContext } from '../../../../Auth/AuthProviders/AuthProvider';
import Chip from '../../../../common/Chip/Chip.component';
import { DomainLabel } from '../../../../common/DomainLabel/DomainLabel.component';
import InlineEdit from '../../../../common/InlineEdit/InlineEdit.component';
import { PersonaSelectableList } from '../../../../MyData/Persona/PersonaSelectableList/PersonaSelectableList.component';
import ChangePasswordForm from '../../ChangePasswordForm';
import UserProfileImage from '../UserProfileImage/UserProfileImage.component';
import { UserProfileDetailsProps } from './UserProfileDetails.interface';

const UserProfileDetails = ({
  userData,
  updateUserDetails,
}: UserProfileDetailsProps) => {
  const { t } = useTranslation();
  const { fqn: username } = useFqn();
  const { isAdminUser } = useAuth();
  const { authConfig, currentUser } = useAuthContext();

  const [isLoading, setIsLoading] = useState(false);
  const [isChangePassword, setIsChangePassword] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState(userData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);

  const isSelfProfileView = useMemo(
    () => userData?.id === currentUser?.id,
    [userData, currentUser]
  );

  const isAuthProviderBasic = useMemo(
    () =>
      authConfig?.provider === AuthProvider.Basic ||
      authConfig?.provider === AuthProvider.LDAP,
    [authConfig]
  );

  const isLoggedInUser = useMemo(
    () => username === currentUser?.name,
    [username, currentUser]
  );

  const hasEditPermission = useMemo(
    () => isAdminUser || isLoggedInUser,
    [isAdminUser, isLoggedInUser]
  );

  const hasPersonaEditPermission = useMemo(
    () => isAdminUser || isSelfProfileView,
    [isAdminUser, isSelfProfileView]
  );

  const showChangePasswordComponent = useMemo(
    () => isAuthProviderBasic && hasEditPermission,
    [isAuthProviderBasic, hasEditPermission]
  );

  const defaultPersona = useMemo(
    () =>
      userData.personas?.find(
        (persona) => persona.id === userData.defaultPersona?.id
      ),
    [userData]
  );

  const onDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setDisplayName(e.target.value);

  const handleDisplayNameSave = useCallback(async () => {
    if (displayName !== userData.displayName) {
      setIsLoading(true);
      await updateUserDetails({ displayName: displayName ?? '' });
      setIsLoading(false);
    }
    setIsDisplayNameEdit(false);
  }, [userData.displayName, displayName, updateUserDetails]);

  const displayNameRenderComponent = useMemo(
    () =>
      isDisplayNameEdit && hasEditPermission ? (
        <InlineEdit
          isLoading={isLoading}
          onCancel={() => setIsDisplayNameEdit(false)}
          onSave={handleDisplayNameSave}>
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
        <Space align="center">
          <Typography.Text
            className="font-medium text-md"
            data-testid="user-name"
            ellipsis={{ tooltip: true }}
            style={{ maxWidth: '400px' }}>
            {hasEditPermission
              ? userData.displayName ||
                t('label.add-entity', { entity: t('label.display-name') })
              : getEntityName(userData)}
          </Typography.Text>
          {hasEditPermission && (
            <Tooltip
              title={t('label.edit-entity', {
                entity: t('label.display-name'),
              })}>
              <EditIcon
                className="cursor-pointer align-middle"
                color={DE_ACTIVE_COLOR}
                data-testid="edit-displayName"
                {...ICON_DIMENSION}
                onClick={() => setIsDisplayNameEdit(true)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    [
      userData,
      displayName,
      isDisplayNameEdit,
      hasEditPermission,
      getEntityName,
      onDisplayNameChange,
      handleDisplayNameSave,
    ]
  );

  const changePasswordRenderComponent = useMemo(
    () =>
      showChangePasswordComponent && (
        <Button
          className="w-full text-xs"
          data-testid="change-password-button"
          type="primary"
          onClick={() => setIsChangePassword(true)}>
          {t('label.change-entity', {
            entity: t('label.password-lowercase'),
          })}
        </Button>
      ),
    [showChangePasswordComponent]
  );
  const handleChangePassword = async (data: ChangePasswordRequest) => {
    try {
      setIsLoading(true);

      const newData = {
        username: userData.name,
        requestType: isLoggedInUser ? RequestType.Self : RequestType.User,
      };

      const sendData = {
        ...data,
        ...newData,
      };

      await changePassword(sendData);

      showSuccessToast(
        t('server.update-entity-success', { entity: t('label.password') })
      );

      setIsChangePassword(false);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const userEmailRender = useMemo(
    () => (
      <Space align="center">
        <Typography.Text
          className="text-grey-muted"
          data-testid="user-email-label">{`${t(
          'label.email'
        )} :`}</Typography.Text>

        <Typography.Paragraph className="m-b-0" data-testid="user-email-value">
          {userData.email}
        </Typography.Paragraph>
      </Space>
    ),
    [userData.email]
  );

  const userDomainRender = useMemo(
    () => (
      <Space align="center">
        <Typography.Text
          className="text-grey-muted"
          data-testid="user-domain-label">{`${t(
          'label.domain'
        )} :`}</Typography.Text>
        <Space align="center">
          <DomainLabel
            domain={userData?.domain}
            entityFqn={userData.fullyQualifiedName ?? ''}
            entityId={userData.id ?? ''}
            entityType={EntityType.USER}
            hasPermission={false}
          />
        </Space>
      </Space>
    ),
    [userData.domain]
  );

  const handleDefaultPersonaUpdate = useCallback(
    async (defaultPersona?: EntityReference) => {
      await updateUserDetails({ ...userData, defaultPersona });
    },
    [updateUserDetails, userData]
  );

  const defaultPersonaRender = useMemo(
    () => (
      <Space align="center">
        <Typography.Text
          className="text-grey-muted"
          data-testid="default-persona-label">
          {`${t('label.default-persona')} :`}
        </Typography.Text>

        <Chip
          showNoDataPlaceholder
          data={defaultPersona ? [defaultPersona] : []}
          noDataPlaceholder={NO_DATA_PLACEHOLDER}
        />

        <PersonaSelectableList
          hasPermission={hasPersonaEditPermission}
          multiSelect={false}
          personaList={userData.personas}
          selectedPersonas={defaultPersona ? [defaultPersona] : []}
          onUpdate={handleDefaultPersonaUpdate}
        />
      </Space>
    ),
    [
      userData.personas,
      hasPersonaEditPermission,
      defaultPersona,
      handleDefaultPersonaUpdate,
    ]
  );

  return (
    <>
      <Space
        wrap
        className="w-full justify-between"
        data-testid="user-profile-details"
        size="middle">
        <Space className="w-full">
          <UserProfileImage userData={userData} />
          {displayNameRenderComponent}
          <Divider type="vertical" />

          {userEmailRender}
          <Divider type="vertical" />

          {defaultPersonaRender}
          <Divider type="vertical" />

          {userDomainRender}
        </Space>

        {changePasswordRenderComponent}
      </Space>

      {showChangePasswordComponent && (
        <ChangePasswordForm
          isLoading={isLoading}
          isLoggedInUser={isLoggedInUser}
          visible={isChangePassword}
          onCancel={() => setIsChangePassword(false)}
          onSave={(data) => handleChangePassword(data)}
        />
      )}
    </>
  );
};

export default UserProfileDetails;
