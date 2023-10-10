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
import { CheckOutlined } from '@ant-design/icons';
import { Dropdown, Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as DropDownIcon } from '../../../assets/svg/DropDown.svg';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
  NO_DATA_PLACEHOLDER,
  TERM_USER,
} from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import { updateUserDetail } from '../../../rest/userAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import i18n from '../../../utils/i18next/LocalUtil';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import Avatar from '../../common/avatar/Avatar';

export const UserProfileIcon = () => {
  const { currentUser, onLogoutHandler, updateCurrentUser } = useAuthContext();
  const [isImgUrlValid, setIsImgUrlValid] = useState<boolean>(true);
  const { t } = useTranslation();
  const profilePicture = useMemo(
    () => currentUser?.profile?.images?.image512,
    [currentUser]
  );

  const handleOnImageError = useCallback(() => {
    setIsImgUrlValid(false);
  }, []);

  const handleDefaultPersonaChange = async (persona: EntityReference) => {
    if (!currentUser) {
      return;
    }
    const operations = compare(currentUser, {
      ...currentUser,
      defaultPersona: { id: persona.id, type: 'persona' },
    });

    try {
      const updatedUser = await updateUserDetail(currentUser.id, operations);
      updateCurrentUser(updatedUser);
    } catch (error) {
      // Error
    }
  };

  useEffect(() => {
    if (profilePicture) {
      setIsImgUrlValid(true);
    }
  }, [profilePicture]);

  const { userName, defaultPersona, teams, roles } = useMemo(() => {
    const userName = currentUser?.displayName ?? currentUser?.name ?? TERM_USER;
    const defaultPersona = currentUser?.personas?.find(
      (persona) => persona.id === currentUser.defaultPersona?.id
    );

    return {
      userName,
      defaultPersona,
      roles: currentUser?.roles,
      teams: currentUser?.teams,
    };
  }, [currentUser]);

  const noDataMenuItem = {
    label: NO_DATA_PLACEHOLDER,
    key: '',
  };

  const items: ItemType[] = useMemo(
    () => [
      {
        key: 'user',
        icon: '',
        label: (
          <Link
            data-testid="user-name"
            to={getUserPath(currentUser?.name as string)}>
            <Typography.Paragraph
              className="ant-typography-ellipsis-custom font-medium cursor-pointer text-link-color m-b-0"
              ellipsis={{ rows: 1, tooltip: true }}>
              {userName}
            </Typography.Paragraph>
          </Link>
        ),
        type: 'group',
      },
      {
        type: 'divider', // Must have
      },
      {
        key: 'roles',
        icon: '',
        children: isEmpty(roles)
          ? [{ ...noDataMenuItem, key: 'no-roles' }]
          : roles?.map((role) => ({
              label: getEntityName(role),
              key: role.id,
            })),
        label: (
          <span className="text-grey-muted">{i18n.t('label.role-plural')}</span>
        ),
        type: 'group',
      },
      {
        type: 'divider',
      },
      {
        key: 'inheritedRoles',
        icon: '',
        children: currentUser?.inheritedRoles?.map((role) => ({
          label: getEntityName(role),
          key: role.id,
        })) ?? [{ ...noDataMenuItem, key: 'no-inherited-roles' }],
        label: (
          <span className="text-grey-muted">
            {i18n.t('label.inherited-role-plural')}
          </span>
        ),
        type: 'group',
      },
      {
        type: 'divider',
      },
      {
        key: 'personas',
        icon: '',
        children: currentUser?.personas?.map((persona) => ({
          label: getEntityName(persona),
          key: persona.id,
          onClick: () => handleDefaultPersonaChange(persona),
          icon: defaultPersona?.id === persona.id && <CheckOutlined />,
        })) ?? [{ ...noDataMenuItem, key: 'no-persona' }],
        label: (
          <span className="text-grey-muted">
            {i18n.t('label.persona-plural')}
          </span>
        ),
        type: 'group',
      },
      {
        type: 'divider',
      },
      {
        key: 'teams',
        icon: '',
        children: isEmpty(teams)
          ? [{ ...noDataMenuItem, key: 'no-teams' }]
          : teams?.map((team) => ({
              label: (
                <Link
                  className="ant-typography-ellipsis-custom text-sm m-b-0"
                  component={Typography.Link}
                  to={getTeamAndUserDetailsPath(team.name as string)}>
                  {getEntityName(team)}
                </Link>
              ),
              key: team.id,
            })),
        label: (
          <span className="text-grey-muted">{i18n.t('label.team-plural')}</span>
        ),
        type: 'group',
      },
      {
        type: 'divider',
      },
      {
        key: 'logout',
        icon: '',
        label: (
          <Typography.Paragraph
            className="font-medium cursor-pointer text-link-color m-b-0"
            onClick={onLogoutHandler}>
            {i18n.t('label.logout')}
          </Typography.Paragraph>
        ),
        type: 'group',
      },
    ],
    [currentUser, userName, defaultPersona, teams, roles]
  );

  return (
    <Dropdown
      menu={{
        items,
        defaultOpenKeys: ['personas', 'roles', 'inheritedRoles', 'teams'],
      }}
      trigger={['click']}>
      <div className="app-user-icon">
        <div className="d-flex gap-2 w-40 items-center">
          {isImgUrlValid ? (
            <img
              alt="user"
              className="profile-image circle"
              referrerPolicy="no-referrer"
              src={profilePicture ?? ''}
              width={36}
              onError={handleOnImageError}
            />
          ) : (
            <Avatar name={userName} type="circle" width="36" />
          )}
          <div className="d-flex flex-col">
            <Typography.Text className="usename">
              {getEntityName(currentUser)}
            </Typography.Text>
            <Typography.Text
              className="text-grey-muted text-xs"
              ellipsis={{ tooltip: true }}>
              {defaultPersona
                ? getEntityName(defaultPersona)
                : t('label.default-persona')}
            </Typography.Text>
          </div>
        </div>
        <DropDownIcon width={16} />
      </div>
    </Dropdown>
  );
};
