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
import classNames from 'classnames';
import { get, isEmpty } from 'lodash';
import React, {
  FC,
  Fragment,
  HTMLAttributes,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as IconTeams } from '../../../assets/svg/teams-grey.svg';
import { ReactComponent as IconUsers } from '../../../assets/svg/user.svg';
import { TERM_ADMIN } from '../../../constants/constants';
import { TabSpecificField } from '../../../enums/entity.enum';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/type/entityReference';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { getUserByName } from '../../../rest/userAPI';
import { getNonDeletedTeams } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
} from '../../../utils/RouterUtils';
import { getUserWithImage } from '../../../utils/UserDataUtils';
import Loader from '../Loader/Loader';
import ProfilePicture from '../ProfilePicture/ProfilePicture';

export const UserTeams = React.memo(({ userName }: { userName: string }) => {
  const { userProfilePics } = useApplicationStore();
  const userData = userProfilePics[userName];
  const teams = getNonDeletedTeams(userData?.teams ?? []);
  const { t } = useTranslation();

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
            {getEntityName(team)}
          </span>
        ))}
      </p>
    </div>
  ) : null;
});

export const UserRoles = React.memo(({ userName }: { userName: string }) => {
  const { userProfilePics } = useApplicationStore();
  const userData = userProfilePics[userName];
  const roles = userData?.roles;
  const isAdmin = userData?.isAdmin;
  const { t } = useTranslation();

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
});

export const PopoverContent = React.memo(
  ({
    userName,
    type = OwnerType.USER,
  }: {
    userName: string;
    type: OwnerType;
  }) => {
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
    }, [userName]);

    useEffect(() => {
      if (!teamDetails && !isTeam) {
        getUserWithAdditionalDetails();
      } else {
        setLoading(false);
      }
    }, [teamDetails, isTeam]);

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

export const PopoverTitle = React.memo(
  ({
    userName,
    profilePicture,
    type = OwnerType.USER,
  }: {
    userName: string;
    profilePicture: JSX.Element;
    type: OwnerType;
  }) => {
    const navigate = useNavigate();

    const [, , userData] = useUserProfile({
      permission: true,
      name: userName,
      isTeam: type === OwnerType.TEAM,
    });

    const onTitleClickHandler = (path: string) => {
      navigate(path);
    };
    const name = userData?.name ?? '';
    const displayName = getEntityName(userData as unknown as EntityReference);

    return (
      <Space align="center">
        {profilePicture}
        <div className="self-center">
          <Button
            className="text-info p-0"
            type="link"
            onClick={(e) => {
              e.stopPropagation();
              onTitleClickHandler(getUserPath(name));
            }}>
            <span className="font-medium m-r-xs" data-testid="user-name">
              {displayName}
            </span>
          </Button>
          {displayName !== name ? (
            <span className="text-grey-muted">{name}</span>
          ) : null}
          {isEmpty(userData) && <span>{userName}</span>}
        </div>
      </Space>
    );
  }
);

export interface Props extends HTMLAttributes<HTMLDivElement> {
  userName: string;
  displayName?: ReactNode;
  type?: OwnerType;
  showUserName?: boolean;
  showUserProfile?: boolean;
  profileWidth?: number;
  className?: string;
}

const UserPopOverCard: FC<Props> = ({
  userName,
  displayName,
  type = OwnerType.USER,
  showUserName = false,
  showUserProfile = true,
  children,
  className,
  profileWidth = 24,
}) => {
  const profilePicture = (
    <ProfilePicture
      avatarType="outlined"
      isTeam={type === OwnerType.TEAM}
      name={userName}
      width={`${profileWidth}`}
    />
  );

  return (
    <Popover
      align={{ targetOffset: [0, -10] }}
      content={<PopoverContent type={type} userName={userName} />}
      overlayClassName="ant-popover-card"
      title={
        <PopoverTitle
          profilePicture={profilePicture}
          type={type}
          userName={userName}
        />
      }
      trigger="hover"
      zIndex={9999}>
      {(children as ReactNode) ?? (
        <Link
          className={classNames(
            'assignee-item d-flex gap-1 cursor-pointer items-center',
            {
              'm-r-xs': !showUserName && showUserProfile,
            },
            className
          )}
          data-testid={userName}
          to={
            type === OwnerType.TEAM
              ? getTeamAndUserDetailsPath(userName)
              : getUserPath(userName ?? '')
          }>
          {showUserProfile ? profilePicture : null}
          {showUserName ? (
            <span className="truncate">{displayName ?? userName}</span>
          ) : null}
        </Link>
      )}
    </Popover>
  );
};

export default UserPopOverCard;
