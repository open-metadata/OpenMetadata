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

import { Button, Col, Input, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import AppState from '../../../../AppState';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { useAuthContext } from '../../../../components/authentication/auth-provider/AuthProvider';
import DescriptionV1 from '../../../../components/common/description/DescriptionV1';
import InlineEdit from '../../../../components/InlineEdit/InlineEdit.component';
import ChangePasswordForm from '../../../../components/Users/ChangePasswordForm';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
} from '../../../../constants/constants';
import { EntityType } from '../../../../enums/entity.enum';
import {
  ChangePasswordRequest,
  RequestType,
} from '../../../../generated/auth/changePasswordRequest';
import { EntityReference } from '../../../../generated/entity/type';
import { AuthProvider } from '../../../../generated/settings/settings';
import { useAuth } from '../../../../hooks/authHooks';
import { changePassword } from '../../../../rest/auth-API';
import { getEntityName } from '../../../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { UserProfileDetailsProps } from './UserProfileDetails.interface';

const UserProfileDetails = ({
  userData,
  updateUserDetails,
}: UserProfileDetailsProps) => {
  const { t } = useTranslation();
  const { fqn: username } = useParams<{ fqn: string }>();

  const { isAdminUser } = useAuth();
  const { authConfig } = useAuthContext();

  const [isLoading, setIsLoading] = useState(false);
  const [isChangePassword, setIsChangePassword] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState(userData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);
  const [isDescriptionEdit, setIsDescriptionEdit] = useState(false);

  const isAuthProviderBasic = useMemo(
    () =>
      authConfig?.provider === AuthProvider.Basic ||
      authConfig?.provider === AuthProvider.LDAP,
    [authConfig]
  );

  const isLoggedInUser = useMemo(
    () => username === AppState.getCurrentUserDetails()?.name,
    [username, AppState.nonSecureUserDetails, AppState.userDetails]
  );

  const hasEditPermission = useMemo(
    () => isAdminUser || isLoggedInUser,
    [isAdminUser, isLoggedInUser]
  );

  const onDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

  const handleDescriptionChange = async (description: string) => {
    await updateUserDetails({ description });

    setIsDescriptionEdit(false);
  };

  const handleDisplayNameSave = () => {
    if (displayName !== userData.displayName) {
      updateUserDetails({ displayName: displayName ?? '' });
    }
    setIsDisplayNameEdit(false);
  };

  const displayNameRenderComponent = useMemo(
    () =>
      isDisplayNameEdit && hasEditPermission ? (
        <InlineEdit
          direction="vertical"
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
        <Row align="middle" wrap={false}>
          <Col flex="auto">
            <Typography.Text
              className="text-lg font-medium"
              ellipsis={{ tooltip: true }}>
              {hasEditPermission
                ? userData.displayName ||
                  t('label.add-entity', { entity: t('label.display-name') })
                : getEntityName(userData)}
            </Typography.Text>
          </Col>
          <Col className="d-flex justify-end" flex="25px">
            {hasEditPermission && (
              <EditIcon
                className="cursor-pointer"
                color={DE_ACTIVE_COLOR}
                data-testid="edit-displayName"
                {...ICON_DIMENSION}
                onClick={() => setIsDisplayNameEdit(true)}
              />
            )}
          </Col>
        </Row>
      ),
    [
      userData,
      isDisplayNameEdit,
      hasEditPermission,
      getEntityName,
      onDisplayNameChange,
      handleDisplayNameSave,
    ]
  );

  const descriptionRenderComponent = useMemo(
    () =>
      hasEditPermission ? (
        <DescriptionV1
          reduceDescription
          description={userData.description ?? ''}
          entityName={getEntityName(userData as unknown as EntityReference)}
          entityType={EntityType.USER}
          hasEditAccess={isAdminUser}
          isEdit={isDescriptionEdit}
          showCommentsIcon={false}
          onCancel={() => setIsDescriptionEdit(false)}
          onDescriptionEdit={() => setIsDescriptionEdit(true)}
          onDescriptionUpdate={handleDescriptionChange}
        />
      ) : (
        <Typography.Paragraph className="m-b-0">
          {userData.description ?? (
            <span className="text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </span>
          )}
        </Typography.Paragraph>
      ),
    [
      userData,
      isAdminUser,
      isDescriptionEdit,
      hasEditPermission,
      getEntityName,
      handleDescriptionChange,
    ]
  );

  const changePasswordRenderComponent = useMemo(
    () =>
      isAuthProviderBasic &&
      (isAdminUser || isLoggedInUser) && (
        <Button
          className="w-full text-xs"
          type="primary"
          onClick={() => setIsChangePassword(true)}>
          {t('label.change-entity', {
            entity: t('label.password-lowercase'),
          })}
        </Button>
      ),
    [isAuthProviderBasic, isAdminUser, isLoggedInUser]
  );

  const handleChangePassword = async (data: ChangePasswordRequest) => {
    try {
      setIsLoading(true);
      const sendData = {
        ...data,
        ...(isAdminUser &&
          !isLoggedInUser && {
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

  return (
    <Space
      className="p-sm w-full"
      data-testid="user-profile-details"
      direction="vertical"
      size="middle">
      <Space className="w-full" direction="vertical" size={2}>
        {displayNameRenderComponent}
        <Typography.Paragraph
          className="m-b-0 text-grey-muted"
          ellipsis={{ tooltip: true }}>
          {userData.email}
        </Typography.Paragraph>
      </Space>

      <Space direction="vertical" size="middle">
        {descriptionRenderComponent}
        {changePasswordRenderComponent}
      </Space>

      <ChangePasswordForm
        isLoading={isLoading}
        isLoggedInUser={isLoggedInUser}
        visible={isChangePassword}
        onCancel={() => setIsChangePassword(false)}
        onSave={(data) => handleChangePassword(data)}
      />
    </Space>
  );
};

export default UserProfileDetails;
