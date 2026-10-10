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

import { Badge, Dropdown, Typography, Tooltip } from '@openmetadata/ui-core-components';
import { Radio } from 'antd';
import { isEmpty, orderBy } from 'lodash';
import {
  FC,
  ReactNode,
  SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DropDownIcon } from '../../../../assets/svg/drop-down.svg';
import { ReactComponent as IconStruct } from '../../../../assets/svg/ic-inherited-roles.svg';
import { ReactComponent as PersonaIcon } from '../../../../assets/svg/ic-persona.svg';
import { ReactComponent as RoleIcon } from '../../../../assets/svg/ic-roles.svg';
import { ReactComponent as LogoutIcon } from '../../../../assets/svg/logout.svg';
import { ReactComponent as TeamIcon } from '../../../../assets/svg/teams-grey.svg';
import { TERM_ADMIN } from '../../../../constants/constants';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import navbarUtilClassBase from '../../../../utils/NavbarUtilClassBase';
import {
  getImageWithResolutionAndFallback,
  ImageQuality,
} from '../../../../utils/ProfilerUtils';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
} from '../../../../utils/RouterUtils';
import { getEmptyTextFromUserProfileItem } from '../../../../utils/UsersPureUtils';
import InterfaceModeMenuItem from '../../../AppModeSwitcher/InterfaceModeMenuItem';
import { useAuthProvider } from '../../../Auth/AuthProviders/AuthProvider';
import ProfilePicture from '../../../common/ProfilePicture/ProfilePicture';
import ThemeModeSwitcher from '../../../ThemeModeSwitcher/ThemeModeSwitcher';
import './user-profile-icon.less';

const LIST_ITEM_CLASS = 'tw:pl-6';

type ListSectionProps = {
  id: string;
  icon: FC<SVGProps<SVGSVGElement>>;
  title: string;
  listItems: EntityReference[];
  labelRenderer: (item: EntityReference) => ReactNode;
  getItemHref?: (item: EntityReference) => string;
  onItemAction?: (item: EntityReference) => void;
  renderReadMore: (count: number) => ReactNode;
  sizeLimit?: number;
};

const renderListSection = ({
  id,
  icon: Icon,
  title,
  listItems,
  labelRenderer,
  getItemHref,
  onItemAction,
  renderReadMore,
  sizeLimit = 2,
}: ListSectionProps) => {
  const items = listItems.slice(0, sizeLimit);
  const remainingCount = Math.max(listItems.length - sizeLimit, 0);
  const isReadOnly = !getItemHref && !onItemAction;

  return (
    <Dropdown.Section id={id}>
      <Dropdown.SectionHeader className="tw:flex tw:items-center tw:gap-2 tw:px-4 tw:py-2 tw:text-sm tw:font-medium tw:text-primary">
        <Icon className="tw:text-fg-quaternary" height={20} width={20} />
        {title}
      </Dropdown.SectionHeader>
      {isEmpty(items) ? (
        <Dropdown.Item
          isDisabled
          className={LIST_ITEM_CLASS}
          id={`no-${id}`}
          label={getEmptyTextFromUserProfileItem(id)}
        />
      ) : (
        items.map((item) => (
          <Dropdown.Item
            className={LIST_ITEM_CLASS}
            href={getItemHref?.(item)}
            id={`${id}-${item.id ?? item.name}`}
            isDisabled={isReadOnly}
            key={item.id ?? item.name}
            textValue={getEntityName(item)}
            onAction={onItemAction ? () => onItemAction(item) : undefined}>
            {labelRenderer(item)}
          </Dropdown.Item>
        ))
      )}
      {remainingCount > 0 && renderReadMore(remainingCount)}
    </Dropdown.Section>
  );
};

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

  const handleOnImageError = useCallback(() => {
    setIsImgUrlValid(false);

    return false;
  }, []);

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
  }, [currentUser]);

  const personaLabelRenderer = useCallback(
    (item: EntityReference) => (
      <div
        className="tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-2"
        data-testid="persona-label">
        <div className="tw:flex tw:min-w-0 tw:items-center default-persona-container">
          <Typography ellipsis={{ tooltip: true }}>
            {getEntityName(item)}
          </Typography>

          {defaultPersona?.id === item.id && (
            <Badge
              className="tw:mr-2 tw:ml-1 tw:font-medium tw:shadow-xs"
              color="brand"
              data-testid="default-persona-tag"
              size="sm"
              type="color">
              {t('label.default')}
            </Badge>
          )}
        </div>

        <Radio checked={selectedPersona?.id === item.id} />
      </div>
    ),
    [selectedPersona, defaultPersona, t]
  );

  const getTeamHref = useCallback(
    (item: EntityReference) => getTeamAndUserDetailsPath(item.name as string),
    []
  );

  const userPath = getUserPath(currentUser?.name as string);

  const renderMoreItem = useCallback(
    (id: string, count: number) => (
      <Dropdown.Item
        className={LIST_ITEM_CLASS}
        href={userPath}
        id={`more-${id}`}
        label={`${count} ${t('label.more')}`}
      />
    ),
    [userPath, t]
  );

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

  return (
    <Dropdown.Root>
      <AriaButton
        className="user-profile-btn tw:flex tw:cursor-pointer tw:items-center tw:gap-4 tw:bg-transparent tw:p-0"
        data-testid="dropdown-profile">
        {isImgUrlValid ? (
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- onError load fallback
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
        )}
        <div className="name-persona-container">
          <Tooltip arrow excludeTriggerFromTabOrder title={getEntityName(currentUser)} triggerClassName="tw:inline-flex">
            <Typography
              className="name-persona-text font-semibold"
              data-testid="nav-user-name">
              {getEntityName(currentUser)}
            </Typography>
          </Tooltip>

          <Typography
            className="name-persona-text"
            data-testid="default-persona">
            {isEmpty(selectedPersona)
              ? t('label.default')
              : getEntityName(selectedPersona)}
          </Typography>
        </div>
        <DropDownIcon width={12} />
      </AriaButton>
      <Dropdown.Popover
        className="user-profile-dropdown-overlay tw:w-68"
        placement="bottom end">
        <Dropdown.Menu
          aria-label={getEntityName(currentUser)}
          className="profile-dropdown tw:max-h-72 tw:overflow-y-auto"
          selectionMode="none">
          <Dropdown.Item
            data-testid="user-name"
            href={userPath}
            id="user"
            label={t('label.view-entity', { entity: t('label.profile') })}
          />
          <Dropdown.Separator />
          {renderListSection({
            id: 'personas',
            icon: PersonaIcon,
            title: t('label.switch-persona'),
            listItems: sortedPersonas,
            sizeLimit: showAllPersona ? sortedPersonas.length : 2,
            labelRenderer: personaLabelRenderer,
            onItemAction: setSelectedPersona,
            renderReadMore: (count) => (
              <Dropdown.Item
                className={LIST_ITEM_CLASS}
                id="more-persona"
                label={`${count} ${t('label.more')}`}
                shouldCloseOnSelect={false}
                onAction={() => setShowAllPersona(true)}
              />
            ),
          })}
          <Dropdown.Separator />
          {renderListSection({
            id: 'roles',
            icon: RoleIcon,
            title: t('label.role-plural'),
            listItems: roles ?? [],
            labelRenderer: getEntityName,
            renderReadMore: (count) => renderMoreItem('roles', count),
          })}
          <Dropdown.Separator />
          {renderListSection({
            id: 'inheritedRoles',
            icon: IconStruct,
            title: t('label.inherited-role-plural'),
            listItems: inheritedRoles ?? [],
            labelRenderer: getEntityName,
            renderReadMore: (count) => renderMoreItem('inherited-roles', count),
          })}
          <Dropdown.Separator />
          {renderListSection({
            id: 'teams',
            icon: TeamIcon,
            title: t('label.team-plural'),
            listItems: teams ?? [],
            labelRenderer: getEntityName,
            getItemHref: getTeamHref,
            renderReadMore: (count) => renderMoreItem('teams', count),
          })}
          <Dropdown.Separator />
          <Dropdown.Item
            icon={LogoutIcon}
            id="logout"
            label={t('label.logout')}
            onAction={onLogoutHandler}
          />
        </Dropdown.Menu>
        <div className="tw:flex tw:flex-col tw:gap-3 tw:border-t tw:border-secondary tw:px-4 tw:py-3">
          <InterfaceModeMenuItem />
          {navbarUtilClassBase.getUserProfileExtraItems()}
          <ThemeModeSwitcher className="tw:w-full" />
        </div>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};
