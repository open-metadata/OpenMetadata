/*
 *  Copyright 2022 Collate.
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

import { Button, Popover, Space } from 'antd';
import { t } from 'i18next';
import { isEmpty } from 'lodash';
import React, {
  FC,
  Fragment,
  HTMLAttributes,
  useEffect,
  useState,
} from 'react';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconTeams } from '../../../assets/svg/teams-grey.svg';
import { ReactComponent as IconUsers } from '../../../assets/svg/user.svg';
import { getUserPath, TERM_ADMIN } from '../../../constants/constants';
import { EntityReference } from '../../../generated/type/entityReference';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { getUserByName } from '../../../rest/userAPI';
import { getNonDeletedTeams } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { useApplicationConfigContext } from '../../ApplicationConfigProvider/ApplicationConfigProvider';
import Loader from '../../Loader/Loader';
import ProfilePicture from '../ProfilePicture/ProfilePicture';

const UserTeams = ({ userName }: { userName: string }) => {
  const { userProfilePics } = useApplicationConfigContext();
  const userData = userProfilePics[userName];
  const teams = getNonDeletedTeams(userData?.teams ?? []);

  return teams?.length ? (
    <div className="m-t-xs">
      <p className="d-flex items-center">
        <IconTeams height={16} width={16} />
        <span className="m-r-xs m-l-xss align-middle font-medium">
          {t('label.team-plural')}
        </span>
      </p>

      <p className="d-flex flex-wrap m-t-xss">
        {teams.map((team) => (
          <span
            className="bg-grey rounded-4 p-x-xs text-grey-body text-xs m-b-xss"
            key={team.id}>
            {team?.displayName ?? team?.name}
          </span>
        ))}
      </p>
    </div>
  ) : null;
};

const UserRoles = ({ userName }: { userName: string }) => {
  const { userProfilePics } = useApplicationConfigContext();
  const userData = userProfilePics[userName];
  const roles = userData?.roles;
  const isAdmin = userData?.isAdmin;

  return roles?.length ? (
    <div className="m-t-xs">
      <p className="d-flex items-center">
        <IconUsers height={16} width={16} />
        <span className="m-r-xs m-l-xss align-middle font-medium">
          {t('label.role-plural')}
        </span>
      </p>

      <span className="d-flex flex-wrap m-t-xss">
        {isAdmin && (
          <span className="bg-grey rounded-4 p-x-xs text-xs m-b-xss">
            {TERM_ADMIN}
          </span>
        )}
        {roles.map((role) => (
          <span
            className="bg-grey rounded-4 p-x-xs text-xs m-b-xss"
            key={role.id}>
            {getEntityName(role)}
          </span>
        ))}
      </span>
    </div>
  ) : null;
};

const PopoverContent = ({ userName }: { userName: string }) => {
  const { userProfilePics, updateUserProfilePics } =
    useApplicationConfigContext();
  const [isLoading, setIsLoading] = useState(true);
  const user = userProfilePics[userName];

  useEffect(() => {
    const getUserWithAdditionalDetails = (userName: string) => {
      setIsLoading(true);
      getUserByName(userName, 'teams, roles, profile')
        .then((user) => {
          updateUserProfilePics({
            id: userName,
            user,
          });
          setIsLoading(false);
        })
        .finally(() => {
          setIsLoading(false);
        });
    };

    if (!user?.hasOwnProperty('teams')) {
      getUserWithAdditionalDetails(userName);
    } else {
      setIsLoading(false);
    }
  }, [user, userName]);

  return (
    <Fragment>
      {isLoading ? (
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
};

interface Props extends HTMLAttributes<HTMLDivElement> {
  userName: string;
  type?: string;
}

const UserPopOverCard: FC<Props> = ({ children, userName, type = 'user' }) => {
  const history = useHistory();

  const [, , userData] = useUserProfile({
    permission: true,
    name: userName,
  });

  const onTitleClickHandler = (path: string) => {
    history.push(path);
  };
  const PopoverTitle = () => {
    const name = userData?.name ?? '';
    const displayName = getEntityName(userData as unknown as EntityReference);

    return (
      <Space align="center">
        <ProfilePicture name={userName} type="circle" width="24" />
        <div className="self-center">
          <Button
            className="text-info p-0"
            type="link"
            onClick={(e) => {
              e.stopPropagation();
              onTitleClickHandler(getUserPath(name));
            }}>
            <span className="font-medium m-r-xs">{displayName}</span>
          </Button>
          {displayName !== name ? (
            <span className="text-grey-muted">{name}</span>
          ) : null}
          {isEmpty(userData) && <span>{userName}</span>}
        </div>
      </Space>
    );
  };

  const container = document.getElementById('app-container') || document.body;

  return (
    <Popover
      align={{ targetOffset: [0, -10] }}
      content={() => <PopoverContent userName={userName} />}
      getPopupContainer={() => container}
      overlayClassName="ant-popover-card"
      title={<PopoverTitle />}
      trigger="hover">
      {children}
    </Popover>
  );
};

export default UserPopOverCard;
