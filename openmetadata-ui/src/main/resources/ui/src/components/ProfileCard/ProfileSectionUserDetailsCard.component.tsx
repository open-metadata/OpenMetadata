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
import { Badge, Button, Modal, Popover, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditProfileIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as ChangePassword } from '../../assets/svg/ic-change-pw.svg';
import { ReactComponent as MenuDots } from '../../assets/svg/ic-menu-dots.svg';
import { ReactComponent as DeleteIcon } from '../../assets/svg/ic-trash.svg';
import { User } from '../../generated/entity/teams/user';
import { getUserOnlineStatus, isMaskedEmail } from '../../utils/Users.util';

import Icon from '@ant-design/icons';
import { AxiosError } from 'axios';
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
import { getEntityName } from '../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import DeleteWidgetModal from '../common/DeleteWidget/DeleteWidgetModal';
import UserPopOverCard from '../common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import { ProfileEditModal } from '../Modals/ProfileEditModal/ProfileEditModal';
import ChangePasswordForm from '../Settings/Users/ChangePasswordForm';
import './profile-details.less';

interface ProfileSectionUserDetailsCardProps {
  userData: User;
  afterDeleteAction: (isSoftDelete?: boolean, version?: number) => void;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
  handleRestoreUser: () => Promise<void>;
}

const ProfileSectionUserDetailsCard = ({
  userData,
  afterDeleteAction,
  updateUserDetails,
  handleRestoreUser,
}: ProfileSectionUserDetailsCardProps) => {
  const { t } = useTranslation();
  const { fqn: username } = useFqn();
  const { isAdminUser } = useAuth();
  const { authConfig, currentUser } = useApplicationStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isChangePassword, setIsChangePassword] = useState<boolean>(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [editProfile, setEditProfile] = useState<boolean>(false);
  const [isPopoverVisible, setisPopoverVisible] = useState<boolean>(false);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
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

  const onlineStatus = useMemo(() => {
    return getUserOnlineStatus(userData, false);
  }, [userData]);

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
        <Typography.Paragraph
          className="m-b-0 profile-details-email"
          data-testid="user-email-value">
          {userData.email}
        </Typography.Paragraph>
      ),
    [userData.email]
  );

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      await handleRestoreUser();
    } finally {
      setIsRestoring(false);
      setShowRestoreModal(false);
    }
  };

  const manageProfileOptions = (
    <div style={{ width: '180px' }}>
      {isLoggedInUser && (
        <Button
          className="profile-manage-item d-flex item-center w-full text-left border-0  bg-transparent remove-button-default-styling"
          data-testid="edit-displayname"
          onClick={() => {
            setEditProfile(!editProfile);
            setisPopoverVisible(false);
          }}>
          <EditProfileIcon
            className="m-r-xss"
            style={{ marginRight: '10px' }}
            {...ICON_DIMENSION_USER_PAGE}
          />
          <Typography.Text className="profile-manage-label">
            {t('label.edit-entity', {
              entity: t('label.display-name'),
            })}
          </Typography.Text>
        </Button>
      )}
      {showChangePasswordComponent && (isLoggedInUser || isAdminUser) && (
        <Button
          className="profile-manage-item d-flex item-center w-full text-left border-0  bg-transparent remove-button-default-styling"
          data-testid="change-password-button"
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
        </Button>
      )}
      {userData?.deleted ? (
        <Button
          className="profile-manage-item d-flex item-center w-full text-left border-0 bg-transparent remove-button-default-styling"
          onClick={() => {
            setShowRestoreModal(true);
            setisPopoverVisible(false);
          }}>
          <DeleteIcon
            className="m-r-xss"
            style={{ marginRight: '10px' }}
            {...ICON_DIMENSION_USER_PAGE}
          />
          <Typography.Text className="profile-manage-label">
            {t('label.restore')}
          </Typography.Text>
        </Button>
      ) : (
        isAdminUser && (
          <Button
            className="remove-button-default-styling profile-manage-item d-flex item-center w-full text-left border-0  bg-transparent"
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
          </Button>
        )
      )}
    </div>
  );

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
        trigger="click"
        onOpenChange={(visible) => setisPopoverVisible(visible)}>
        {(isAdminUser || isLoggedInUser) && (
          <MenuDots
            className="cursor-pointer user-details-menu-icon"
            data-testid="user-profile-manage-btn"
            onClick={() => setisPopoverVisible((prev) => !prev)}
          />
        )}
      </Popover>

      <div className="m-t-sm">
        <UserPopOverCard userName={userData?.name}>
          <div className="d-flex items-center">
            <ProfilePicture
              data-testid="replied-user"
              name={userData?.name}
              width="80"
            />
          </div>
        </UserPopOverCard>
      </div>
      <div className="d-flex flex-col items-center">
        <p className="profile-details-title" data-testid="user-display-name">
          {getEntityName(userData)}
        </p>
        {userEmailRender}
        {onlineStatus && (
          <div className="m-t-sm">
            <Badge
              data-testid="user-online-status"
              status={onlineStatus.status}
              text={onlineStatus.text}
            />
          </div>
        )}
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
          isRecursiveDelete
          afterDeleteAction={afterDeleteAction}
          allowSoftDelete={!userData.deleted}
          entityId={userData.id}
          entityName={getEntityName(userData)}
          entityType={EntityType.USER}
          visible={isDelete}
          onCancel={() => setIsDelete(false)}
        />
      )}
      {editProfile && (
        <ProfileEditModal
          updateUserDetails={updateUserDetails}
          userData={userData}
          onCancel={handleModalClose}
        />
      )}
      {userData.deleted && (
        <span
          className="user-profile-deleted-badge"
          data-testid="deleted-badge">
          <Icon
            className="m-r-xss font-medium text-md ant-icon"
            component={DeleteIcon}
          />

          {t('label.deleted')}
        </span>
      )}

      {showRestoreModal && (
        <Button
          className="remove-button-default-styling"
          onClick={(e) => e.stopPropagation()}>
          <Modal
            centered
            cancelButtonProps={{
              type: 'link',
              disabled: isRestoring,
            }}
            className="reactive-modal"
            closable={false}
            confirmLoading={isRestoring}
            data-testid="restore-user-modal"
            maskClosable={false}
            okButtonProps={{
              loading: isRestoring,
            }}
            okText={t('label.restore')}
            open={showRestoreModal}
            title={t('label.restore-entity', {
              entity: EntityType.USER,
            })}
            onCancel={() => setShowRestoreModal(false)}
            onOk={handleRestore}>
            <Typography.Text data-testid="restore-modal-body">
              {t('message.are-you-want-to-restore', {
                entity: getEntityName(userData),
              })}
            </Typography.Text>
          </Modal>
        </Button>
      )}
    </div>
  );
};

export default ProfileSectionUserDetailsCard;
