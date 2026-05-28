/*
 *  Copyright 2024 Collate.
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
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { isEmpty } from 'lodash';
import type {
  ListMenuItemProps,
  UserProfileIconMenuItemsProps,
} from '../components/Settings/Users/UserProfileIcon/UserProfileIcon.interface';
import { HELP_ITEMS } from '../constants/Navbar.constants';
import { getEntityName } from './EntityUtils';
import { getEmptyTextFromUserProfileItem } from './Users.util';

const renderLimitedListMenuItem = ({
  listItems,
  labelRenderer,
  readMoreLabelRenderer,
  sizeLimit = 2,
  readMoreKey,
  itemKey,
}: ListMenuItemProps) => {
  const remainingCount =
    listItems.length > sizeLimit ? listItems.length - sizeLimit : 0;

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
        ...items.map((item) => ({
          label: labelRenderer(item),
          key: item.id,
          disabled: ['roles', 'inheritedRoles'].includes(itemKey),
        })),
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

class NavbarUtilClassBase {
  public getHelpItems() {
    return HELP_ITEMS;
  }

  public getUserProfileIconDefaultOpenKeys(): string[] {
    return ['personas', 'roles', 'inheritedRoles', 'teams'];
  }

  public getUserProfileIconMenuItems({
    inheritedRoleLabel,
    inheritedRoles,
    logoutLabel,
    personaLabel,
    personaLabelRenderer,
    personas,
    readMoreLabelRenderer,
    roleLabel,
    roles,
    showAllPersona,
    teamLabel,
    teamLabelRenderer,
    teams,
    userLabel,
  }: UserProfileIconMenuItemsProps): ItemType[] {
    return [
      {
        key: 'user',
        icon: '',
        label: userLabel,
        type: 'group',
      },
      {
        type: 'divider',
      },
      {
        key: 'personas',
        icon: '',
        children: renderLimitedListMenuItem({
          listItems: personas,
          readMoreKey: 'more-persona',
          sizeLimit: showAllPersona ? personas.length : 2,
          labelRenderer: personaLabelRenderer,
          readMoreLabelRenderer: (count) => readMoreLabelRenderer(count, true),
          itemKey: 'personas',
        }),
        label: personaLabel,
        type: 'group',
      },
      {
        type: 'divider',
      },
      {
        key: 'roles',
        icon: '',
        children: renderLimitedListMenuItem({
          listItems: roles,
          labelRenderer: getEntityName,
          readMoreLabelRenderer,
          readMoreKey: 'more-roles',
          itemKey: 'roles',
        }),
        label: roleLabel,
        type: 'group',
      },
      {
        type: 'divider',
      },
      {
        key: 'inheritedRoles',
        icon: '',
        children: renderLimitedListMenuItem({
          listItems: inheritedRoles,
          labelRenderer: getEntityName,
          readMoreLabelRenderer,
          readMoreKey: 'more-inherited-roles',
          itemKey: 'inheritedRoles',
        }),
        label: inheritedRoleLabel,
        type: 'group',
      },
      {
        type: 'divider',
      },
      {
        type: 'divider',
      },
      {
        key: 'teams',
        icon: '',
        children: renderLimitedListMenuItem({
          listItems: teams,
          readMoreKey: 'more-teams',
          labelRenderer: teamLabelRenderer,
          readMoreLabelRenderer,
          itemKey: 'teams',
        }),
        label: teamLabel,
        type: 'group',
      },
      {
        type: 'divider',
      },
      {
        key: 'logout',
        icon: '',
        label: logoutLabel,
        type: 'group',
      },
    ];
  }
}

const navbarUtilClassBase = new NavbarUtilClassBase();

export default navbarUtilClassBase;
export { NavbarUtilClassBase };
