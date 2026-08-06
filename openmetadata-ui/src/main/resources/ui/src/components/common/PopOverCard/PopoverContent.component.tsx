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

import { get, isEmpty } from 'lodash';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../enums/entity.enum';
import { OwnerType } from '../../../enums/user.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { getUserByName } from '../../../rest/userAPI';
import { getUserWithImage } from '../../../utils/UserDataUtils';
import Loader from '../Loader/Loader';
import { PopoverContentProps } from './UserPopOverCard.interface';
import { UserRoles } from './UserRoles.component';
import { UserTeams } from './UserTeams.component';

export const PopoverContent = React.memo(
  ({ userName, type = OwnerType.USER }: PopoverContentProps) => {
    const isTeam = type === OwnerType.TEAM;
    const [, , user = {}] = useUserProfile({
      permission: true,
      name: userName,
      isTeam,
    });
    const { updateUserProfilePics } = useApplicationStore();
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();
    const teamDetails = get(user, 'teams', null);

    const getUserWithAdditionalDetails = useCallback(async () => {
      try {
        setLoading(true);
        let user = await getUserByName(userName, {
          fields: [
            TabSpecificField.TEAMS,
            TabSpecificField.ROLES,
            TabSpecificField.PROFILE,
          ],
        });
        user = getUserWithImage(user);

        updateUserProfilePics({
          id: userName,
          user,
        });
      } catch {
        // Error
      } finally {
        setLoading(false);
      }
    }, [userName, updateUserProfilePics]);

    useEffect(() => {
      if (!teamDetails && !isTeam) {
        getUserWithAdditionalDetails();
      } else {
        setLoading(false);
      }
    }, [teamDetails, isTeam, getUserWithAdditionalDetails]);

    return (
      <Fragment>
        {loading ? (
          <Loader size="small" />
        ) : (
          <div className="w-40">
            {isEmpty(user) ? (
              <span>{t('message.no-data-available')}</span>
            ) : (
              <Fragment>
                <UserTeams userName={userName} />
                <UserRoles userName={userName} />
              </Fragment>
            )}
          </div>
        )}
      </Fragment>
    );
  }
);
