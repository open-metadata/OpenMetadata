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
import { Button, Dropdown, Space, Tooltip, Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as DropDownIcon } from '../../../../assets/svg/drop-down.svg';
import { ReactComponent as IconStruct } from '../../../../assets/svg/ic-inherited-roles.svg';
import { ReactComponent as PersonaIcon } from '../../../../assets/svg/ic-persona.svg';
import { ReactComponent as RoleIcon } from '../../../../assets/svg/ic-roles.svg';
import { ReactComponent as LogoutIcon } from '../../../../assets/svg/logout.svg';
import { ReactComponent as TeamIcon } from '../../../../assets/svg/teams-grey.svg';
import {
  LIGHT_GREEN_COLOR,
  TERM_ADMIN,
  TERM_USER,
} from '../../../../constants/constants';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { updateUserDetail } from '../../../../rest/userAPI';
import { getEntityName } from '../../../../utils/EntityUtils';
import {
  getImageWithResolutionAndFallback,
  ImageQuality,
} from '../../../../utils/ProfilerUtils';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
} from '../../../../utils/RouterUtils';
import { getEmptyTextFromUserProfileItem } from '../../../../utils/Users.util';
import { useAuthProvider } from '../../../Auth/AuthProviders/AuthProvider';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import './user-profile-icon.less';

type ListMenuItemProps = {
  listItems: EntityReference[];
  labelRenderer: (item: EntityReference) => ReactNode;
  readMoreLabelRenderer: (count: number) => ReactNode;
  readMoreKey: string;
  sizeLimit?: number;
  itemKey: string;
};

const renderLimitedListMenuItem = ({
  listItems,
  labelRenderer,
  readMoreLabelRenderer,
  sizeLimit = 2,
  readMoreKey,
  itemKey,
}: ListMenuItemProps) => {
  const remainingCount =
    listItems.length ?? 0 > sizeLimit
      ? (listItems.length ?? sizeLimit) - sizeLimit
      : 0;

  const items = listItems.slice(0, sizeLimit);

  return isEmpty(items)
    ? [
        {
          label: getEmptyTextFromUserProfileItem(itemKey),
          key: readMoreKey.replace('more', 'no'),
          disabled: true,
        },
      ]
    : [
        ...(items?.map((item) => ({
          label: labelRenderer(item),
          key: item.id,
          disabled: ['roles', 'inheritedRoles'].includes(itemKey),
        })) ?? []),
        ...[
          remainingCount > 0
            ? {
                label: readMoreLabelRenderer(remainingCount),
                key: readMoreKey ?? 'more-item',
              }
            : null,
        ],
      ];
};

export const UserProfileIcon = () => {
  const { currentUser, selectedPersona, setCurrentUser } =
    useApplicationStore();
  const { onLogoutHandler } = useAuthProvider();

  const [isImgUrlValid, setIsImgUrlValid] = useState<boolean>(true);
  const { t } = useTranslation();
  const profilePicture = getImageWithResolutionAndFallback(
    ImageQuality['6x'],
    currentUser?.profile?.images
  );
  const [showAllPersona, setShowAllPersona] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  const handleOnImageError = useCallback(() => {
    setIsImgUrlValid(false);

    return false;
  }, []);

  const handleSelectedPersonaChange = async (persona: EntityReference) => {
    if (!currentUser) {
      return;
    }

    const isAlreadySelected = selectedPersona?.id === persona.id;

    const updatedDetails = {
      ...currentUser,
      defaultPersona: isAlreadySelected ? undefined : persona,
    };
    const jsonPatch = compare(currentUser, updatedDetails);

    const response = await updateUserDetail(currentUser?.id, jsonPatch);

    setCurrentUser(response);
  };

  useEffect(() => {
    if (profilePicture) {
      setIsImgUrlValid(true);
    } else {
      setIsImgUrlValid(false);
    }
  }, [profilePicture]);

  const { userName, teams, roles, inheritedRoles, personas } = useMemo(() => {
    const userName = getEntityName(currentUser) || TERM_USER;

    return {
      userName,
      roles: currentUser?.isAdmin
        ? [
            ...(currentUser?.roles ?? []),
            { name: TERM_ADMIN, type: 'role' } as EntityReference,
          ]
        : currentUser?.roles,
      teams: currentUser?.teams,
      inheritedRoles: currentUser?.inheritedRoles,
      personas: currentUser?.personas,
    };
  }, [currentUser, currentUser?.personas]);

  const personaLabelRenderer = useCallback(
    (item: EntityReference) => (
      <Space
        className="w-full d-flex justify-between persona-label"
        data-testid="persona-label"
        onClick={() => handleSelectedPersonaChange(item)}>
        <Typography.Text ellipsis={{ tooltip: { placement: 'left' } }}>
          {getEntityName(item)}
        </Typography.Text>
        {selectedPersona?.id === item.id && (
          <CheckOutlined
            className="m-x-xs"
            data-testid="check-outlined"
            style={{ color: LIGHT_GREEN_COLOR }}
          />
        )}
      </Space>
    ),
    [handleSelectedPersonaChange, selectedPersona]
  );

  const teamLabelRenderer = useCallback(
    (item: EntityReference) => (
      <Link
        className="ant-typography-ellipsis-custom text-sm m-b-0 p-0"
        to={getTeamAndUserDetailsPath(item.name as string)}>
        {getEntityName(item)}
      </Link>
    ),
    []
  );

  const readMoreTeamRenderer = useCallback(
    (count: number, isPersona?: boolean) =>
      isPersona ? (
        <Typography.Text
          className="more-teams-pill"
          onClick={(e) => {
            e.stopPropagation();
            setShowAllPersona(true);
          }}>
          {count} {t('label.more')}
        </Typography.Text>
      ) : (
        <Link
          className="more-teams-pill"
          to={getUserPath(currentUser?.name as string)}>
          {count} {t('label.more')}
        </Link>
      ),
    [currentUser]
  );

  const handleCloseDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const items: ItemType[] = useMemo(
    () => [
      {
        key: 'user',
        icon: '',
        label: (
          <Link
            data-testid="user-name"
            to={getUserPath(currentUser?.name as string)}
            onClick={handleCloseDropdown}>
            <Typography.Paragraph
              className="ant-typography-ellipsis-custom font-medium cursor-pointer text-link-color m-b-0"
              ellipsis={{ rows: 1, tooltip: true }}>
              {t('label.view-entity', { entity: t('label.profile') })}
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
        children: renderLimitedListMenuItem({
          listItems: roles ?? [],
          labelRenderer: getEntityName,
          readMoreLabelRenderer: readMoreTeamRenderer,
          readMoreKey: 'more-roles',
          itemKey: 'roles',
        }),
        label: (
          <div className="text-base-color d-flex items-center gap-2">
            <RoleIcon height={20} width={20} />
            <span className="font-medium text-grey-900">
              {t('label.role-plural')}
            </span>
          </div>
        ),
        type: 'group',
      },
      {
        type: 'divider',
      },
      {
        key: 'inheritedRoles',
        icon: '',
        children: renderLimitedListMenuItem({
          listItems: inheritedRoles ?? [],
          labelRenderer: getEntityName,
          readMoreLabelRenderer: readMoreTeamRenderer,
          readMoreKey: 'more-inherited-roles',
          itemKey: 'inheritedRoles',
        }),
        label: (
          <div className="d-flex items-center gap-2">
            <IconStruct className="text-base-color" height={20} width={20} />
            <span className="font-medium text-grey-900">
              {t('label.inherited-role-plural')}
            </span>
          </div>
        ),
        type: 'group',
      },
      {
        type: 'divider',
      },
      {
        key: 'personas',
        icon: '',
        children: renderLimitedListMenuItem({
          listItems: personas ?? [],
          readMoreKey: 'more-persona',
          sizeLimit: showAllPersona ? personas?.length : 2,
          labelRenderer: personaLabelRenderer,
          readMoreLabelRenderer: (count) => readMoreTeamRenderer(count, true),
          itemKey: 'personas',
        }),
        label: (
          <div className="d-flex items-center gap-2">
            <PersonaIcon className="text-base-color" height={20} width={20} />
            <span className="font-medium text-grey-900">
              {t('label.persona-plural')}
            </span>
          </div>
        ),
        type: 'group',
      },
      {
        type: 'divider',
      },
      {
        key: 'teams',
        icon: '',
        children: renderLimitedListMenuItem({
          listItems: teams ?? [],
          readMoreKey: 'more-teams',
          labelRenderer: teamLabelRenderer,
          readMoreLabelRenderer: readMoreTeamRenderer,
          itemKey: 'teams',
        }),
        label: (
          <div className="d-flex items-center gap-2">
            <TeamIcon className="text-base-color" height={20} width={20} />
            <span className="font-medium text-grey-900">
              {t('label.team-plural')}
            </span>
          </div>
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
          <Button
            className="text-primary d-flex items-center gap-2 p-0 font-medium"
            type="text"
            onClick={onLogoutHandler}>
            <LogoutIcon height={20} width={20} />
            {t('label.logout')}
          </Button>
        ),
        type: 'group',
      },
    ],
    [
      currentUser,
      userName,
      selectedPersona,
      teams,
      roles,
      personas,
      showAllPersona,
    ]
  );

  return (
    <Dropdown
      menu={{
        items,
        defaultOpenKeys: ['personas', 'roles', 'inheritedRoles', 'teams'],
        rootClassName: 'profile-dropdown w-68 p-x-md p-y-sm',
      }}
      open={isDropdownOpen}
      overlayClassName="user-profile-dropdown-overlay"
      trigger={['click']}
      onOpenChange={setIsDropdownOpen}>
      <Button
        className="user-profile-btn flex-center"
        data-testid="dropdown-profile"
        icon={
          isImgUrlValid ? (
            <img
              alt={getEntityName(currentUser)}
              className="app-bar-user-profile-pic"
              data-testid="app-bar-user-profile-pic"
              referrerPolicy="no-referrer"
              src={profilePicture ?? ''}
              onError={handleOnImageError}
            />
          ) : (
            <ProfilePicture
              displayName={currentUser?.name}
              name={currentUser?.name ?? ''}
              width="40"
            />
          )
        }
        size="large"
        type="text">
        <div className="name-persona-container">
          <Tooltip title={getEntityName(currentUser)}>
            <Typography.Text
              className="font-semibold"
              data-testid="nav-user-name">
              {getEntityName(currentUser)}
            </Typography.Text>
          </Tooltip>

          <Typography.Text
            data-testid="default-persona"
            ellipsis={{ tooltip: true }}>
            {isEmpty(selectedPersona)
              ? t('label.default')
              : getEntityName(selectedPersona)}
          </Typography.Text>
        </div>
        <DropDownIcon width={12} />
      </Button>
    </Dropdown>
  );
};
