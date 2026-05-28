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
import { Button, Dropdown, Radio, Tag, Tooltip, Typography } from 'antd';
import { isEmpty, orderBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as DropDownIcon } from '../../../../assets/svg/drop-down.svg';
import { ReactComponent as IconStruct } from '../../../../assets/svg/ic-inherited-roles.svg';
import { ReactComponent as PersonaIcon } from '../../../../assets/svg/ic-persona.svg';
import { ReactComponent as RoleIcon } from '../../../../assets/svg/ic-roles.svg';
import { ReactComponent as LogoutIcon } from '../../../../assets/svg/logout.svg';
import { ReactComponent as TeamIcon } from '../../../../assets/svg/teams-grey.svg';
import { TERM_ADMIN } from '../../../../constants/constants';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getEntityName } from '../../../../utils/EntityUtils';
import navbarUtilClassBase from '../../../../utils/NavbarUtilClassBase';
import {
  getImageWithResolutionAndFallback,
  ImageQuality,
} from '../../../../utils/ProfilerUtils';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
} from '../../../../utils/RouterUtils';
import { useAuthProvider } from '../../../Auth/AuthProviders/AuthProvider';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import './user-profile-icon.less';

export const UserProfileIcon = () => {
  const { currentUser, selectedPersona, setSelectedPersona } =
    useApplicationStore();
  const defaultPersona = currentUser?.defaultPersona;
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

  const handleSelectedPersonaChange = useCallback(
    (persona: EntityReference) => {
      setSelectedPersona(persona);
    },
    [setSelectedPersona]
  );

  useEffect(() => {
    if (profilePicture) {
      setIsImgUrlValid(true);
    } else {
      setIsImgUrlValid(false);
    }
  }, [profilePicture]);

  const { teams, roles, inheritedRoles, personas } = useMemo(() => {
    return {
      roles: currentUser?.isAdmin
        ? [
            ...(currentUser?.roles ?? []),
            { name: TERM_ADMIN, type: 'role' } as EntityReference,
          ]
        : currentUser?.roles,
      teams: currentUser?.teams,
      inheritedRoles: currentUser?.inheritedRoles,
      personas: (() => {
        const directPersonas = currentUser?.personas ?? [];
        const inheritedPersonas = currentUser?.inheritedPersonas ?? [];
        const allPersonas = [...directPersonas, ...inheritedPersonas];

        if (currentUser?.defaultPersona) {
          allPersonas.push(currentUser.defaultPersona);
        }

        // Deduplicate by id
        const uniquePersonasMap = new Map();
        allPersonas.forEach((p) => uniquePersonasMap.set(p.id, p));

        return Array.from(uniquePersonasMap.values());
      })(),
    };
  }, [currentUser, currentUser?.personas, currentUser?.inheritedPersonas]);

  const personaLabelRenderer = useCallback(
    (item: EntityReference) => {
      const isDefaultPersona = defaultPersona?.id === item.id;

      return (
        <div
          className="w-full d-flex items-center persona-label cursor-pointer d-flex justify-between"
          data-testid="persona-label"
          onClick={() => handleSelectedPersonaChange(item)}>
          <div className="d-flex items-center default-persona-container">
            <Typography.Text ellipsis={{ tooltip: true }}>
              {getEntityName(item)}
            </Typography.Text>

            {isDefaultPersona && (
              <Tag
                className="m-l-xs default-persona-tag"
                data-testid="default-persona-tag">
                {t('label.default')}
              </Tag>
            )}
          </div>

          <Radio checked={selectedPersona?.id === item.id} />
        </div>
      );
    },
    [handleSelectedPersonaChange, selectedPersona, defaultPersona, t]
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
    [currentUser, t]
  );

  const handleCloseDropdown = useCallback(() => {
    setIsDropdownOpen(false);
  }, []);

  const sortedPersonas = useMemo(() => {
    if (!personas?.length) {
      return [];
    }

    const defaultId = defaultPersona?.id;
    const selectedId = selectedPersona?.id;

    const others: typeof personas = [];
    let defaultMatch: typeof defaultPersona | undefined;
    let selectedMatch: typeof selectedPersona | undefined;

    for (const p of personas) {
      if (p.id === defaultId) {
        defaultMatch = p;
      } else if (p.id === selectedId) {
        selectedMatch = p;
      } else {
        others.push(p);
      }
    }

    // Sort remaining personas alphabetically
    const sortedOthers = orderBy(others, (p) => getEntityName(p), 'asc');

    return [
      ...(defaultMatch ? [defaultMatch] : []),
      ...(selectedMatch ? [selectedMatch] : []),
      ...sortedOthers,
    ];
  }, [personas, defaultPersona?.id, selectedPersona?.id]);

  const items = useMemo(
    () =>
      navbarUtilClassBase.getUserProfileIconMenuItems({
        userLabel: (
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
        personaLabel: (
          <div className="d-flex items-center gap-2">
            <PersonaIcon className="text-base-color" height={20} width={20} />
            <span className="font-medium text-grey-900">
              {t('label.switch-persona')}
            </span>
          </div>
        ),
        roleLabel: (
          <div className="text-base-color d-flex items-center gap-2">
            <RoleIcon height={20} width={20} />
            <span className="font-medium text-grey-900">
              {t('label.role-plural')}
            </span>
          </div>
        ),
        inheritedRoleLabel: (
          <div className="d-flex items-center gap-2">
            <IconStruct className="text-base-color" height={20} width={20} />
            <span className="font-medium text-grey-900">
              {t('label.inherited-role-plural')}
            </span>
          </div>
        ),
        teamLabel: (
          <div className="d-flex items-center gap-2">
            <TeamIcon className="text-base-color" height={20} width={20} />
            <span className="font-medium text-grey-900">
              {t('label.team-plural')}
            </span>
          </div>
        ),
        logoutLabel: (
          <Button
            className="text-primary d-flex items-center gap-2 p-0 font-medium"
            type="text"
            onClick={onLogoutHandler}>
            <LogoutIcon height={20} width={20} />
            {t('label.logout')}
          </Button>
        ),
        inheritedRoles: inheritedRoles ?? [],
        personaLabelRenderer,
        personas: sortedPersonas,
        readMoreLabelRenderer: readMoreTeamRenderer,
        roles: roles ?? [],
        showAllPersona,
        teamLabelRenderer,
        teams: teams ?? [],
      }),
    [
      currentUser?.name,
      handleCloseDropdown,
      inheritedRoles,
      onLogoutHandler,
      personaLabelRenderer,
      readMoreTeamRenderer,
      roles,
      showAllPersona,
      sortedPersonas,
      t,
      teamLabelRenderer,
      teams,
    ]
  );

  return (
    <Dropdown
      menu={{
        items,
        defaultOpenKeys:
          navbarUtilClassBase.getUserProfileIconDefaultOpenKeys(),
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
