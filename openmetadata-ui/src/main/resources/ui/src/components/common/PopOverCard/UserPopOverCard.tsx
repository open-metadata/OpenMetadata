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
import { getUserByName } from 'rest/userAPI';
import { getEntityName } from 'utils/EntityUtils';
import AppState from '../../../AppState';
import { getUserPath, TERM_ADMIN } from '../../../constants/constants';
import { User } from '../../../generated/entity/teams/user';
import { EntityReference } from '../../../generated/type/entityReference';
import { getNonDeletedTeams } from '../../../utils/CommonUtils';
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
      <p className="m-t-xs">
        <SVGIcons alt="icon" className="w-4" icon={Icons.TEAMS_GREY} />
        <span className="m-r-xs m-l-xss align-middle font-medium">
          {t('label.team-plural')}
        </span>
        <span className="d-flex flex-wrap m-t-xss">
          {teams.map((team, i) => (
            <span
              className="bg-grey rounded-4 p-x-xs text-grey-body text-xs"
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
      <p className="m-t-xs">
        <SVGIcons alt="icon" className="w-4" icon={Icons.USERS} />
        <span className="m-r-xs m-l-xss align-middle font-medium">
          {t('label.role-plural')}
        </span>
        <span className="d-flex flex-wrap m-t-xss">
          {isAdmin && (
            <span className="bg-grey rounded-4 p-x-xs text-xs">
              {TERM_ADMIN}
            </span>
          )}
          {roles.map((role, i) => (
            <span className="bg-grey rounded-4 p-x-xs text-xs" key={i}>
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
      <div className="d-flex">
        <div className="m-r-xs">
          <ProfilePicture id="" name={userName} width="24" />
        </div>
        <div className="self-center">
          <button
            className="text-info"
            onClick={(e) => {
              e.stopPropagation();
              onTitleClickHandler(getUserPath(name));
            }}>
            <span className="font-medium m-r-xs">{displayName}</span>
          </button>
          {displayName !== name ? (
            <span className="text-grey-muted">{name}</span>
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
          <div className="w-40">
            {isEmpty(userData) ? (
              <span>{t('message.no-data-available')}</span>
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
