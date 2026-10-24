/*
 *  Copyright 2026 Collate.
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

import { FC } from 'react';
import { User } from '../../../../../../generated/entity/teams/user';
import ActivityTab from '../../../InboxPage/tabs/ActivityTab';
import TasksTab from '../../../InboxPage/tabs/TasksTab';
import UserAssetsView from '../../../UserAssets/UserAssetsView';
import UserCustomPropertiesList from '../../customProperties/UserCustomPropertiesList';
import ProfileDetailsPanel from '../../ProfileDetailsPanel';
import PermissionsTab from '../PermissionsTab';
import type { UserDetailTab } from './Members.types';

interface UserDetailTabContentProps {
  user: User;
  tab: UserDetailTab;
  isProfileLoading: boolean;
  canEditAll: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<boolean>;
  onOpenTask: (taskId: string) => void;
}

/** The body of the selected user-detail tab. */
const UserDetailTabContent: FC<UserDetailTabContentProps> = ({
  user,
  tab,
  isProfileLoading,
  canEditAll,
  updateUserDetails,
  onOpenTask,
}) => {
  switch (tab) {
    case 'access':
      return (
        <PermissionsTab
          canEditTeams={canEditAll}
          updateUserDetails={updateUserDetails}
          userData={user}
        />
      );
    case 'activity':
      return <ActivityTab user={user} />;
    case 'tasks':
      return <TasksTab user={user} onOpenTask={onOpenTask} />;
    case 'owned-assets':
      return <UserAssetsView kind="owned" user={user} />;
    case 'following':
      return <UserAssetsView kind="following" user={user} />;
    case 'custom-properties':
      return (
        <UserCustomPropertiesList
          isProfileLoading={isProfileLoading}
          user={user}
          onUpdate={updateUserDetails}
        />
      );
    default:
      return (
        <ProfileDetailsPanel
          canEditAll={canEditAll}
          isProfileLoading={isProfileLoading}
          updateUserDetails={updateUserDetails}
          userData={user}
        />
      );
  }
};

export default UserDetailTabContent;
