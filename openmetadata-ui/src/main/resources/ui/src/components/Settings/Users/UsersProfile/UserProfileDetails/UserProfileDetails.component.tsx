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

import { ExclamationCircleFilled } from '@ant-design/icons';
import { Button, Divider, Input, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { useFqn } from '../../../../../hooks/useFqn';
import { changePassword } from '../../../../../rest/auth-API';
import { restoreUser } from '../../../../../rest/userAPI';
import { getEntityName } from '../../../../../utils/EntityUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import { isMaskedEmail } from '../../../../../utils/Users.util';
import Chip from '../../../../common/Chip/Chip.component';
import { DomainLabel } from '../../../../common/DomainLabel/DomainLabel.component';
import ManageButton from '../../../../common/EntityPageInfos/ManageButton/ManageButton';
import InlineEdit from '../../../../common/InlineEdit/InlineEdit.component';
import { PersonaSelectableList } from '../../../../MyData/Persona/PersonaSelectableList/PersonaSelectableList.component';
import ChangePasswordForm from '../../ChangePasswordForm';
import UserProfileImage from '../UserProfileImage/UserProfileImage.component';
import { UserProfileDetailsProps } from './UserProfileDetails.interface';

const UserProfileDetails = ({
  userData,
  afterDeleteAction,
  updateUserDetails,
}: UserProfileDetailsProps) => {
  const { t } = useTranslation();
  const { fqn: username } = useFqn();
  const { isAdminUser } = useAuth();
  const { authConfig, currentUser } = useApplicationStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isChangePassword, setIsChangePassword] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState(userData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);

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
    () => (isAdminUser || isLoggedInUser) && !userData.deleted,
    [isAdminUser, isLoggedInUser, userData.deleted]
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

  const onDisplayNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value),
    []
  );

  const handleDisplayNameSave = useCallback(async () => {
    if (displayName !== userData.displayName) {
      setIsLoading(true);
      await updateUserDetails(
        { displayName: isEmpty(displayName) ? undefined : displayName },
        'displayName'
      );
      setIsLoading(false);
    }
    setIsDisplayNameEdit(false);
  }, [userData.displayName, displayName, updateUserDetails]);

  const handleCloseEditDisplayName = useCallback(() => {
    setDisplayName(userData.displayName);
    setIsDisplayNameEdit(false);
  }, [userData.displayName]);

  const changePasswordRenderComponent = useMemo(
    () =>
      showChangePasswordComponent && (
        <Button
          className="w-full text-xs"
          data-testid="change-password-button"
          type="primary"
          onClick={(e) => {
            // Used to stop click propagation event to parent User.component collapsible panel
            e.stopPropagation();
            setIsChangePassword(true);
          }}>
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
    () =>
      !isMaskedEmail(userData.email) && (
        <>
          <Space align="center">
            <Typography.Text
              className="text-grey-muted"
              data-testid="user-email-label">{`${t(
              'label.email'
            )} :`}</Typography.Text>

            <Typography.Paragraph
              className="m-b-0"
              data-testid="user-email-value">
              {userData.email}
            </Typography.Paragraph>
          </Space>
          <Divider type="vertical" />
        </>
      ),
    [userData.email]
  );

  const userDomainRender = useMemo(
    () => (
      <div className="d-flex items-center gap-2">
        <Typography.Text
          className="text-grey-muted"
          data-testid="user-domain-label">{`${t(
          'label.domain'
        )} :`}</Typography.Text>
        <DomainLabel
          multiple
          domain={userData?.domains}
          entityFqn={userData.fullyQualifiedName ?? ''}
          entityId={userData.id ?? ''}
          entityType={EntityType.USER}
          hasPermission={Boolean(isAdminUser) && !userData.deleted}
          textClassName="text-sm text-grey-muted"
        />
      </div>
    ),
    [userData.domains, isAdminUser]
  );

  const handleDefaultPersonaUpdate = useCallback(
    async (defaultPersona?: EntityReference) => {
      await updateUserDetails({ defaultPersona }, 'defaultPersona');
    },
    [updateUserDetails]
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
          entityType={EntityType.PERSONA}
          noDataPlaceholder={NO_DATA_PLACEHOLDER}
        />

        <PersonaSelectableList
          hasPermission={hasEditPermission}
          multiSelect={false}
          personaList={userData.personas}
          selectedPersonas={defaultPersona ? [defaultPersona] : []}
          onUpdate={handleDefaultPersonaUpdate}
        />
      </Space>
    ),
    [
      defaultPersona,
      userData.personas,
      hasEditPermission,
      handleDefaultPersonaUpdate,
    ]
  );

  const handleRestoreUser = useCallback(async () => {
    setIsLoading(true);

    try {
      await restoreUser(userData.id);
      afterDeleteAction(true); // this will reset the user state with deleted to false value.

      showSuccessToast(
        t('message.entity-restored-success', { entity: t('label.user') })
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', { entity: t('label.user') })
      );
    } finally {
      setIsLoading(false);
    }
  }, [userData.id]);

  useEffect(() => {
    // Reset display name when user data changes
    setDisplayName(userData.displayName);
  }, [userData.displayName]);

  return (
    <>
      <Space
        wrap
        className="w-full justify-between"
        data-testid="user-profile-details"
        size="middle">
        <Space className="w-full">
          <UserProfileImage userData={userData} />
          {isDisplayNameEdit ? (
            <InlineEdit
              isLoading={isLoading}
              onCancel={handleCloseEditDisplayName}
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
              {userData.displayName && (
                <Typography.Text
                  className="font-medium text-md"
                  data-testid="user-name"
                  ellipsis={{ tooltip: true }}
                  style={{ maxWidth: '400px' }}>
                  {userData.displayName}
                </Typography.Text>
              )}
              {isLoggedInUser && !userData.deleted && (
                <Tooltip
                  title={t(
                    `label.${
                      isEmpty(userData.displayName) ? 'add' : 'edit'
                    }-entity`,
                    {
                      entity: t('label.display-name'),
                    }
                  )}>
                  <EditIcon
                    className="cursor-pointer align-middle"
                    color={DE_ACTIVE_COLOR}
                    data-testid="edit-displayName"
                    {...ICON_DIMENSION}
                    onClick={(e) => {
                      /* Used to stop click propagation event to parent User.component collapsible panel*/
                      e.stopPropagation();
                      setIsDisplayNameEdit(true);
                    }}
                  />
                </Tooltip>
              )}
            </Space>
          )}
          {userData.deleted && (
            <span className="deleted-badge-button" data-testid="deleted-badge">
              <ExclamationCircleFilled className="m-r-xss font-medium text-xs" />
              {t('label.deleted')}
            </span>
          )}
          <Divider type="vertical" />

          {userEmailRender}

          {defaultPersonaRender}
          <Divider type="vertical" />

          {userDomainRender}
        </Space>

        <div className="d-flex items-center gap-2">
          {changePasswordRenderComponent}

          <ManageButton
            isRecursiveDelete
            afterDeleteAction={afterDeleteAction}
            allowSoftDelete={!userData.deleted}
            canDelete={isAdminUser}
            deleted={userData.deleted}
            displayName={getEntityName(userData)}
            entityId={userData.id}
            entityName={userData.fullyQualifiedName ?? userData.name}
            entityType={EntityType.USER}
            onRestoreEntity={handleRestoreUser}
          />
        </div>
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
