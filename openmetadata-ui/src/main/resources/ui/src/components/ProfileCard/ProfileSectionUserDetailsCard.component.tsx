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
import { Typography } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../generated/entity/teams/user';
import { isMaskedEmail } from '../../utils/Users.util';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';

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

  return (
    <div className="d-flex flex-col flex-center relative profile-section-user-details-card">
      {/* <MenuDots
        {...ICON_DIMENSION_USER_PAGE}
        className="absolute top-2 cursor-pointer"
      /> */}
      <div>
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
          {
            userData?.description && (
              // <p>
              //   Description of admin . Lorem ispum simply dummy text of the
              //   printing and typesetting industry. Lorem Ipsum has been the
              //   industry's standard dummy text ever since the 1500s,
              // </p>
              <></>
            )
            // formatContent(userData?.description, 'client')
          }
        </p>
      </div>
    </div>
  );
};

export default ProfileSectionUserDetailsCard;
