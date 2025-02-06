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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as MenuDots } from '../../assets/svg/dot (1).svg';
import { ReactComponent as EditProfileIcon } from '../../assets/svg/edit-profile.svg';
import { ReactComponent as ChangePassword } from '../../assets/svg/key.svg';
import { ReactComponent as DeleteIcon } from '../../assets/svg/trash.svg';
import { User } from '../../generated/entity/teams/user';
import { getTextFromHtmlString } from '../../utils/BlockEditorUtils';
import { isMaskedEmail } from '../../utils/Users.util';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';

import { ICON_DIMENSION_USER_PAGE } from '../../constants/constants';

interface ProfileSectionUserDetailsCardProps {
  userData: User;
}

const ProfileSectionUserDetailsCard = ({
  userData,
}: ProfileSectionUserDetailsCardProps) => {
  const { t } = useTranslation();
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
  const content = (
    <div className="profile-manage-dropdown" style={{ width: '196px' }}>
      <Button
        className="profile-manage-item d-flex item-center"
        icon={
          <EditProfileIcon
            className="m-r-xss"
            style={{ marginRight: '10px' }}
            {...ICON_DIMENSION_USER_PAGE}
          />
        }
        type="text">
        {t('label.edit-profile')}
      </Button>
      <Button
        className="profile-manage-item d-flex item-center"
        icon={
          <ChangePassword
            className="m-r-xss"
            style={{ marginRight: '10px' }}
            {...ICON_DIMENSION_USER_PAGE}
          />
        }
        type="text">
        {t('label.delete-profile')}
      </Button>
      <Button
        className="profile-manage-item d-flex item-center"
        icon={
          <DeleteIcon
            className="m-r-xss"
            style={{ marginTop: '3px', marginRight: '10px' }}
            {...ICON_DIMENSION_USER_PAGE}
          />
        }
        type="text">
        {t('label.delete-profile')}
      </Button>
    </div>
  );

  return (
    <div className="d-flex flex-col w-full flex-center relative profile-section-user-details-card">
      <Popover
        className="profile-management-popover relative"
        content={content}
        placement="right"
        trigger="click">
        <MenuDots className="cursor-pointer user-details-menu-icon" />
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
        <p className="profile-details-title">{userData?.fullyQualifiedName}</p>
        {userEmailRender}
        <p className="profile-details-desc">
          {userData?.description &&
            getTextFromHtmlString(userData?.description)}
        </p>
      </div>
    </div>
  );
};

export default ProfileSectionUserDetailsCard;
