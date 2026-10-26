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
import {
  BadgeWithDot,
  Button,
  ButtonUtility,
  Popover,
  PopoverTrigger,
  SimpleModal,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditProfileIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as ChangePassword } from '../../assets/svg/ic-change-pw.svg';
import { ReactComponent as MenuDots } from '../../assets/svg/ic-menu-dots.svg';
import { ReactComponent as DeleteIcon } from '../../assets/svg/ic-trash.svg';
import { ICON_DIMENSION_USER_PAGE } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import {
  ChangePasswordRequest,
  RequestType,
} from '../../generated/auth/changePasswordRequest';
import { User } from '../../generated/entity/teams/user';
import { AuthProvider } from '../../generated/settings/settings';
import { useAuth } from '../../hooks/authHooks';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import { changePassword } from '../../rest/auth-API';
import { getEntityName } from '../../utils/EntityNameUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { getUserOnlineStatus, isMaskedEmail } from '../../utils/UsersPureUtils';
import DeleteEntityModal from '../common/DeleteWidget/DeleteEntityModal';
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

interface ProfileManageOptionsProps {
  userData: User;
  isLoggedInUser: boolean;
  isAdminUser: boolean | undefined;
  showChangePasswordComponent: boolean;
  t: ReturnType<typeof useTranslation>['t'];
  onEditDisplayName: () => void;
  onChangePassword: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

const ProfileManageOptions = ({
  userData,
  isLoggedInUser,
  isAdminUser,
  showChangePasswordComponent,
  t,
  onEditDisplayName,
  onChangePassword,
  onRestore,
  onDelete,
}: ProfileManageOptionsProps) => (
  <div style={{ width: '180px' }}>
    {isLoggedInUser && (
      <Button
        className="tw:w-full tw:justify-start"
        color="tertiary"
        data-testid="edit-displayname"
        iconLeading={<EditProfileIcon {...ICON_DIMENSION_USER_PAGE} />}
        onClick={onEditDisplayName}>
        {t('label.edit-entity', {
          entity: t('label.display-name'),
        })}
      </Button>
    )}
    {showChangePasswordComponent && (isLoggedInUser || isAdminUser) && (
      <Button
        className="tw:w-full tw:justify-start"
        color="tertiary"
        data-testid="change-password-button"
        iconLeading={<ChangePassword {...ICON_DIMENSION_USER_PAGE} />}
        onClick={onChangePassword}>
        {t('label.change-entity', {
          entity: t('label.password-lowercase'),
        })}
      </Button>
    )}
    {userData?.deleted ? (
      <Button
        className="tw:w-full tw:justify-start"
        color="tertiary"
        iconLeading={<DeleteIcon {...ICON_DIMENSION_USER_PAGE} />}
        onClick={onRestore}>
        {t('label.restore')}
      </Button>
    ) : (
      isAdminUser && (
        <Button
          className="tw:w-full tw:justify-start"
          color="tertiary"
          iconLeading={<DeleteIcon {...ICON_DIMENSION_USER_PAGE} />}
          onClick={onDelete}>
          {t('label.delete-profile')}
        </Button>
      )
    )}
  </div>
);

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
        <p
          className="tw:m-0 tw:wrap-break-word tw:text-center tw:text-sm tw:leading-5 tw:text-brand-secondary"
          data-testid="user-email-value">
          {userData.email}
        </p>
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
    <ProfileManageOptions
      isAdminUser={isAdminUser}
      isLoggedInUser={isLoggedInUser}
      showChangePasswordComponent={showChangePasswordComponent}
      t={t}
      userData={userData}
      onChangePassword={() => {
        setIsChangePassword(true);
        setisPopoverVisible(false);
      }}
      onDelete={() => {
        setIsDelete(true);
        setisPopoverVisible(false);
      }}
      onEditDisplayName={() => {
        setEditProfile(!editProfile);
        setisPopoverVisible(false);
      }}
      onRestore={() => {
        setShowRestoreModal(true);
        setisPopoverVisible(false);
      }}
    />
  );

  const handleModalClose = async () => {
    setEditProfile(false);
  };

  return (
    <div className="tw:relative tw:mb-5 tw:flex tw:w-full tw:flex-col tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:p-5">
      {(isAdminUser || isLoggedInUser) && (
        <PopoverTrigger
          isOpen={isPopoverVisible}
          onOpenChange={setisPopoverVisible}>
          <ButtonUtility
            aria-label={t('label.manage-entity', {
              entity: t('label.profile'),
            })}
            className="tw:absolute tw:top-2.5 tw:right-2.5"
            color="tertiary"
            data-testid="user-profile-manage-btn"
            icon={<MenuDots height={24} width={24} />}
          />
          <Popover
            className="profile-management-popover"
            placement="bottom start">
            {manageProfileOptions}
          </Popover>
        </PopoverTrigger>
      )}

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
        <p
          className="tw:mt-5 tw:mb-0 tw:text-center tw:text-lg tw:font-semibold tw:leading-7 tw:break-words tw:text-primary"
          data-testid="user-display-name">
          {getEntityName(userData)}
        </p>
        {userEmailRender}
        {onlineStatus && (
          <div className="m-t-sm">
            <span data-testid="user-online-status">
              <BadgeWithDot color="success" size="sm">
                {onlineStatus.text}
              </BadgeWithDot>
            </span>
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
        <DeleteEntityModal
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
          <DeleteIcon className="tw:mr-1 tw:size-3.5 tw:shrink-0" />

          {t('label.deleted')}
        </span>
      )}

      {showRestoreModal && (
        <SimpleModal
          data-testid="restore-user-modal"
          isDismissable={false}
          isOkLoading={isRestoring}
          isOpen={showRestoreModal}
          okText={t('label.restore')}
          title={t('label.restore-entity', {
            entity: EntityType.USER,
          })}
          onCancel={() => setShowRestoreModal(false)}
          onOk={handleRestore}>
          <Typography data-testid="restore-modal-body">
            {t('message.are-you-want-to-restore', {
              entity: getEntityName(userData),
            })}
          </Typography>
        </SimpleModal>
      )}
    </div>
  );
};

export default ProfileSectionUserDetailsCard;
