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
import { Card } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../generated/entity/teams/user';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';

interface ProfileSectionUserDetailsCardProps {
  userData: User;
}

const ProfileSectionUserDetailsCard = ({
  userData,
}: ProfileSectionUserDetailsCardProps) => {
  const { t } = useTranslation();

  return (
    <div className="d-flex">
      {/* Profile Section */}
      <Card
        className="profile-section-user-details-card d-flex mb-4 flex-center"
        style={{
          textAlign: 'center',
          borderRadius: '12px',
        }}>
        <div
          className="d-flex justify-content-center"
          style={{ marginLeft: '75px' }}>
          <ProfilePicture
            avatarType="outlined"
            data-testid="replied-user"
            // key={i}
            name="admin"
            width="80"
          />
        </div>
        {/* <Avatar
          size={80}
          src="https://images.unsplash.com/photo-1607746882042-944635dfe10e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwzNjUyOXwwfDF8c2VhcmNofDd8fHByb2ZpbGUlMjBwaWN0dXJlfGVufDB8fHx8MTY4MjkwMzE2Mw&ixlib=rb-1.2.1&q=80&w=400"
        /> */}
        <div className="profile-details-text">
          <p className="profile-details-title">
            {userData?.fullyQualifiedName}
          </p>
          <p className="profile-details-email">{userData?.email}</p>
          <p
            className="profile-details-desc"
            style={{ margin: '8px 0', padding: '8px' }}>
            {/* Lorem ipsum dolor sit ttur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore et dolore magna */}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ProfileSectionUserDetailsCard;
