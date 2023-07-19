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

import { Col, Row } from 'antd';
import React from 'react';
import './user-profile.less';
import { UserProfileProps } from './UserProfile.interface';
import UserProfileDetails from './UserProfileDetails/UserProfileDetails.component';
import UserProfileImage from './UserProfileImage/UserProfileImage.component';
import UserProfileInheritedRoles from './UserProfileInheritedRoles/UserProfileInheritedRoles.component';
import UserProfileRoles from './UserProfileRoles/UserProfileRoles.component';
import UserProfileTeams from './UserProfileTeams/UserProfileTeams.component';

const UserProfile = ({ userData, updateUserDetails }: UserProfileProps) => {
  return (
    <Row className="user-profile-container">
      <Col className="flex-center border-right" span={4}>
        <UserProfileImage
          userData={{
            id: userData.id,
            name: userData.name,
            displayName: userData.displayName,
            images: userData.profile?.images,
          }}
        />
      </Col>
      <Col className="p-x-sm border-right" span={5}>
        <UserProfileDetails
          updateUserDetails={updateUserDetails}
          userData={{
            email: userData.email,
            name: userData.name,
            displayName: userData.displayName,
            description: userData.description,
          }}
        />
      </Col>
      <Col className="p-x-sm border-right" span={5}>
        <UserProfileTeams
          teams={userData.teams}
          updateUserDetails={updateUserDetails}
        />
      </Col>
      <Col className="p-x-sm border-right" span={5}>
        <UserProfileRoles
          isUserAdmin={userData.isAdmin}
          updateUserDetails={updateUserDetails}
          userRoles={userData.roles}
        />
      </Col>
      <Col className="p-x-sm" span={5}>
        <UserProfileInheritedRoles inheritedRoles={userData.inheritedRoles} />
      </Col>
    </Row>
  );
};

export default UserProfile;
