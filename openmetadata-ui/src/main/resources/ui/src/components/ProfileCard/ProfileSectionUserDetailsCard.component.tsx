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
import { Button, Popover, Typography } from 'antd';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ChangePassword } from '../../assets/svg/change-pw.svg';
import { ReactComponent as MenuDots } from '../../assets/svg/dot (1).svg';
import { ReactComponent as EditProfileIcon } from '../../assets/svg/edit-profile.svg';
import { ReactComponent as DeleteIcon } from '../../assets/svg/trash.svg';
import { User } from '../../generated/entity/teams/user';
import { isMaskedEmail } from '../../utils/Users.util';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';

import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { ICON_DIMENSION_USER_PAGE } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import {
  ChangePasswordRequest,
  RequestType,
} from '../../generated/auth/changePasswordRequest';
import { AuthProvider } from '../../generated/settings/settings';
import { useAuth } from '../../hooks/authHooks';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import { changePassword } from '../../rest/auth-API';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import DeleteWidgetModal from '../common/DeleteWidget/DeleteWidgetModal';
import { ProfileEditModal } from '../Modals/ProfileEditModal/ProfileEditModal';
import ChangePasswordForm from '../Settings/Users/ChangePasswordForm';
import './profile-details.less';

interface ProfileSectionUserDetailsCardProps {
  userData: User;
  afterDeleteAction: (isSoftDelete?: boolean, version?: number) => void;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

const ProfileSectionUserDetailsCard = ({
  userData,
  afterDeleteAction,
  updateUserDetails,
}: ProfileSectionUserDetailsCardProps) => {
  const { t } = useTranslation();
  const { fqn: username } = useFqn();
  const { isAdminUser } = useAuth();
  const { authConfig, currentUser } = useApplicationStore();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChangePassword, setIsChangePassword] = useState<boolean>(false);
  const [displayName, setDisplayName] = useState(userData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [editProfile, setEditProfile] = useState<boolean>(false);
  const [isPopoverVisible, setisPopoverVisible] = useState<boolean>(false);
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
          <Typography.Paragraph
            className="m-b-0 profile-details-email"
            data-testid="user-email-value">
            {userData.email}
          </Typography.Paragraph>
        </>
      ),
    [userData.email]
  );

  const manageProfileOptions = (
    <div style={{ width: '180px' }}>
      <div
        className="profile-manage-item d-flex item-center"
        onClick={() => {
          setEditProfile(true);
          setisPopoverVisible(false);
        }}>
        <EditProfileIcon
          className="m-r-xss"
          style={{ marginRight: '10px' }}
          {...ICON_DIMENSION_USER_PAGE}
        />
        <Typography.Text className="profile-manage-label">
          {t('label.edit-profile')}
        </Typography.Text>
      </div>
      {showChangePasswordComponent && (
        <div
          className="profile-manage-item d-flex item-center"
          onClick={() => {
            setIsChangePassword(true);
            setisPopoverVisible(false);
          }}>
          <ChangePassword
            className="m-r-xss"
            style={{ marginRight: '10px' }}
            {...ICON_DIMENSION_USER_PAGE}
          />
          <Typography.Text className="profile-manage-label">
            {t('label.change-entity', {
              entity: t('label.password-lowercase'),
            })}
          </Typography.Text>
        </div>
      )}
      <div
        className="profile-manage-item d-flex item-center"
        onClick={() => {
          setIsDelete(true);
          setisPopoverVisible(false);
        }}>
        <DeleteIcon
          className="m-r-xss"
          style={{ marginRight: '10px' }}
          {...ICON_DIMENSION_USER_PAGE}
        />
        <Typography.Text className="profile-manage-label">
          {t('label.delete-profile')}
        </Typography.Text>
      </div>
    </div>
  );

  // const handleDescriptionChange = useCallback(
  //   async (description: string) => {
  //     await updateUserDetails({ description }, 'description');

  //     setEditProfile(false);
  //   },
  //   [updateUserDetails, setEditProfile]
  // );
  // const handleProfileUpdate = useCallback(
  //   async (displayName: string, description: string) => {
  //     await updateUserDetails({
  //       updatedDisplayName: displayName,
  //       updatedDescription: description,
  //     });

  //     setEditProfile(false);
  //   },
  //   [updateUserDetails, setEditProfile]
  // );
  const handleModalClose = async () => {
    setEditProfile(false);
  };

  return (
    <div className="d-flex flex-col w-full flex-center relative profile-section-user-details-card">
      <Popover
        destroyTooltipOnHide
        content={manageProfileOptions}
        open={isPopoverVisible}
        overlayClassName="profile-management-popover"
        placement="bottomLeft"
        trigger="click">
        <MenuDots
          className="cursor-pointer user-details-menu-icon"
          onClick={() => setisPopoverVisible(!isPopoverVisible)}
        />
      </Popover>

      <div className="m-t-sm">
        <ProfilePicture
          avatarType="outlined"
          data-testid="replied-user"
          // key={i}
          name="admin"
          width="80"
        />
      </div>
      <div>
        <p className="profile-details-title">{userData?.displayName}</p>
        {userEmailRender}
        {/* <p className="profile-details-desc">
          {userData?.description &&
            getTextFromHtmlString(userData?.description)}
        </p> */}
      </div>
      {showChangePasswordComponent && (
        <ChangePasswordForm
          isLoading={isLoading}
          isLoggedInUser={isLoggedInUser}
          visible={isChangePassword}
          onCancel={() => setIsChangePassword(false)}
          onSave={(data) => handleChangePassword(data)}
        />
      )}

      {isDelete && (
        <DeleteWidgetModal
          afterDeleteAction={afterDeleteAction}
          allowSoftDelete={!userData.deleted}
          // deleteMessage={deleteMessage}
          // deleteOptions={deleteOptions}
          entityId={userData.id}
          entityName={userData.fullyQualifiedName ?? userData.name}
          entityType={EntityType.USER}
          // hardDeleteMessagePostFix={hardDeleteMessagePostFix}
          // isRecursiveDelete={isRecursiveDelete}
          // prepareType={p}
          // softDeleteMessagePostFix={softDeleteMessagePostFix}
          // successMessage={successMessage}
          visible={isDelete}
          onCancel={() => setIsDelete(false)}
        />
      )}
      {editProfile && (
        <ProfileEditModal
          header={t('label.edit-profile')}
          placeholder={t('label.enter-entity', {
            entity: t('label.description'),
          })}
          updateUserDetails={updateUserDetails}
          userData={userData}
          value={userData.description as string}
          visible={Boolean(editProfile)}
          onCancel={() => setEditProfile(false)}
          onSave={handleModalClose}
        />
      )}
    </div>
  );
};

export default ProfileSectionUserDetailsCard;
