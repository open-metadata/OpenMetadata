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

import { Popover } from 'antd';
import { isEmpty } from 'lodash';
import React, {
  FC,
  Fragment,
  HTMLAttributes,
  useEffect,
  useState,
} from 'react';
import { useHistory } from 'react-router-dom';
import { getUserByName } from 'rest/userAPI';
import AppState from '../../../AppState';
import { getUserPath, TERM_ADMIN } from '../../../constants/constants';
import { User } from '../../../generated/entity/teams/user';
import { EntityReference } from '../../../generated/type/entityReference';
import { getEntityName, getNonDeletedTeams } from '../../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import Loader from '../../Loader/Loader';
import ProfilePicture from '../ProfilePicture/ProfilePicture';

interface Props extends HTMLAttributes<HTMLDivElement> {
  userName: string;
  type?: string;
}

const UserPopOverCard: FC<Props> = ({ children, userName, type = 'user' }) => {
  const history = useHistory();
  const [userData, setUserData] = useState<User>({} as User);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const getData = () => {
    const userdetails = AppState.userDataProfiles[userName];
    if (userdetails) {
      setUserData(userdetails);
      setIsLoading(false);
    } else {
      if (type === 'user') {
        setIsLoading(true);
        getUserByName(userName, 'profile,roles,teams,follows,owns')
          .then((res) => {
            AppState.userDataProfiles[userName] = res;
          })
          .finally(() => setIsLoading(false));
      }
    }
  };

  const onTitleClickHandler = (path: string) => {
    history.push(path);
  };

  const UserTeams = () => {
    const teams = getNonDeletedTeams(userData.teams ?? []);

    return teams?.length ? (
      <p className="tw-mt-2">
        <SVGIcons alt="icon" className="tw-w-4" icon={Icons.TEAMS_GREY} />
        <span className="tw-mr-2 tw-ml-1 tw-align-middle tw-font-medium">
          Teams
        </span>
        <span className="tw-flex tw-flex-wrap tw-mt-1">
          {teams.map((team, i) => (
            <span
              className="tw-bg-gray-200 tw-rounded tw-px-1 tw-text-grey-body tw-m-0.5 tw-text-xs"
              key={i}>
              {team?.displayName ?? team?.name}
            </span>
          ))}
        </span>
      </p>
    ) : null;
  };

  const UserRoles = () => {
    const roles = userData.roles;
    const isAdmin = userData?.isAdmin;

    return roles?.length ? (
      <p className="tw-mt-2">
        <SVGIcons alt="icon" className="tw-w-4" icon={Icons.USERS} />
        <span className="tw-mr-2 tw-ml-1 tw-align-middle tw-font-medium">
          Roles
        </span>
        <span className="tw-flex tw-flex-wrap tw-mt-1">
          {isAdmin && (
            <span className="tw-bg-gray-200 tw-rounded tw-px-1 tw-text-grey-body tw-m-0.5 tw-text-xs">
              {TERM_ADMIN}
            </span>
          )}
          {roles.map((role, i) => (
            <span
              className="tw-bg-gray-200 tw-rounded tw-px-1 tw-text-grey-body tw-m-0.5 tw-text-xs"
              key={i}>
              {role?.displayName ?? role?.name}
            </span>
          ))}
        </span>
      </p>
    ) : null;
  };

  const PopoverTitle = () => {
    const name = userData.name ?? '';
    const displayName = getEntityName(userData as unknown as EntityReference);

    return (
      <div className="tw-flex">
        <div className="tw-mr-2">
          <ProfilePicture id="" name={userName} width="24" />
        </div>
        <div className="tw-self-center">
          <button
            className="tw-text-info"
            onClick={(e) => {
              e.stopPropagation();
              onTitleClickHandler(getUserPath(name));
            }}>
            <span className="tw-font-medium tw-mr-2">{displayName}</span>
          </button>
          {displayName !== name ? (
            <span className="tw-text-grey-muted">{name}</span>
          ) : null}
          {isEmpty(userData) && <span>{userName}</span>}
        </div>
      </div>
    );
  };

  const PopoverContent = () => {
    useEffect(() => {
      getData();
    }, []);

    return (
      <Fragment>
        {isLoading ? (
          <Loader size="small" />
        ) : (
          <div className="tw-w-80">
            {isEmpty(userData) ? (
              <span>No data available</span>
            ) : (
              <Fragment>
                <UserTeams />
                <UserRoles />
              </Fragment>
            )}
          </div>
        )}
      </Fragment>
    );
  };

  return (
    <Popover
      destroyTooltipOnHide
      align={{ targetOffset: [0, -10] }}
      content={<PopoverContent />}
      overlayClassName="ant-popover-card"
      title={<PopoverTitle />}
      trigger="hover"
      zIndex={9999}>
      {children}
    </Popover>
  );
};

export default UserPopOverCard;
