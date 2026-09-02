/*
 *  Copyright 2025 Collate.
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

import { Box, Dropdown, Typography } from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  File06,
  HelpCircle,
  Settings01,
  User01,
} from '@untitledui/icons';
import classNames from 'classnames';
import { upperCase } from 'lodash';
import React, { useCallback, useMemo } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  Popover,
  SubmenuTrigger,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthProvider } from '../../../../components/Auth/AuthProviders/AuthProvider';
import ProfilePicture from '../../../../components/common/ProfilePicture/ProfilePicture';
import ThemeModeSwitcher from '../../../../components/ThemeModeSwitcher/ThemeModeSwitcher';
import {
  HELP_ITEMS_ENUM,
  SupportItem,
} from '../../../../constants/Navbar.constants';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { usePersonalSpaceStore } from '../../../../hooks/usePersonalSpaceStore';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { languageSelectOptions } from '../../../../utils/i18next/i18nextUtil';
import i18n from '../../../../utils/i18next/LocalUtil';
import localUtilClassBase from '../../../../utils/i18next/LocalUtilClassBase';
import navbarUtilClassBase from '../../../../utils/NavbarUtilClassBase';
import {
  AIUserMenuProps,
  CurrentUserExtras,
  MenuItemConfig,
} from './AIUserMenu.interface';

// ─── Shared styles ────────────────────────────────────────────────────────────

const SUBMENU_POPOVER_CLASS =
  'tw:w-62 tw:overflow-auto tw:rounded-lg tw:bg-primary tw:shadow-lg ' +
  'tw:outline-1 tw:outline-secondary_alt tw:origin-(--trigger-anchor-point) tw:will-change-transform ' +
  'data-[entering]:tw:duration-150 data-[entering]:tw:ease-out data-[entering]:tw:animate-in data-[entering]:tw:fade-in ' +
  'data-[exiting]:tw:duration-100 data-[exiting]:tw:ease-in data-[exiting]:tw:animate-out data-[exiting]:tw:fade-out';

const SUBMENU_MENU_CLASS =
  'tw:h-min tw:max-h-72 tw:overflow-y-auto tw:py-1 tw:outline-hidden tw:select-none';

const menuItemClass = (isDisabled: boolean) =>
  `tw:group tw:block tw:cursor-pointer tw:px-1.5 tw:py-px tw:outline-hidden${
    isDisabled ? ' tw:cursor-not-allowed' : ''
  }`;

// ─── MenuRow ──────────────────────────────────────────────────────────────────

interface MenuRowProps {
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  isActive?: boolean;
  label: string;
  showChevron?: boolean;
  supportingText?: string;
}

const MenuRow: React.FC<MenuRowProps> = ({
  icon: Icon,
  isActive,
  label,
  showChevron,
  supportingText,
}) => (
  <Box align="start" gap={2}>
    {Icon && (
      <Icon
        className="tw:mt-1 tw:shrink-0 tw:text-gray-400"
        height={14}
        width={14}
      />
    )}
    <Box align="center" className="tw:flex-1" justify="between">
      <Box direction="col">
        <Typography className="tw:text-secondary" weight="semibold">
          {label}
        </Typography>
        {supportingText && (
          <Typography className="tw:text-tertiary" weight="regular">
            {supportingText}
          </Typography>
        )}
      </Box>
      {isActive && (
        <Check
          className="tw:ml-2 tw:shrink-0 tw:text-blue-500"
          height={14}
          width={14}
        />
      )}
      {showChevron && !isActive && (
        <div className="tw:shrink-0">
          <ChevronRight height={12} width={12} />
        </div>
      )}
    </Box>
  </Box>
);

// ─── MenuItemRenderer ─────────────────────────────────────────────────────────

const MenuItemRenderer: React.FC<{ item: MenuItemConfig }> = ({ item }) => {
  if (item.type === 'separator') {
    return <Dropdown.Separator />;
  }

  const hasChildren = (item.children?.length ?? 0) > 0;

  if (hasChildren) {
    return (
      <SubmenuTrigger>
        <Dropdown.Item data-testid={item.dataTestId} id={item.id}>
          {item.node ?? (
            <MenuRow
              showChevron
              icon={item.icon}
              label={item.label ?? ''}
              supportingText={item.supportingText}
            />
          )}
        </Dropdown.Item>
        <Popover
          className={SUBMENU_POPOVER_CLASS}
          offset={4}
          placement="right top">
          <Menu
            className={SUBMENU_MENU_CLASS}
            onAction={(key) => item.onAction?.(String(key))}>
            {(item.children ?? []).map((child) => (
              <MenuItem
                className={menuItemClass(false)}
                data-testid={child.dataTestId}
                id={child.id}
                key={child.id}
                textValue={child.label}
                onAction={() => child.onAction?.()}>
                {child.node ?? (
                  <Box
                    align="center"
                    className="tw:relative tw:rounded-md tw:px-2.5 tw:py-2 tw:transition tw:duration-100 tw:ease-linear tw:group-hover:bg-primary_hover"
                    gap={2}>
                    {child.icon && (
                      <child.icon
                        className="tw:shrink-0 tw:text-gray-400"
                        height={child.iconSize ?? 14}
                        width={child.iconSize ?? 14}
                      />
                    )}
                    <span className="tw:grow tw:truncate tw:text-sm tw:font-semibold tw:text-secondary">
                      {child.label}
                    </span>
                    {child.isActive && (
                      <Check
                        className="tw:ml-auto tw:shrink-0 tw:text-blue-500"
                        height={14}
                        width={14}
                      />
                    )}
                  </Box>
                )}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </SubmenuTrigger>
    );
  }

  if (item.node) {
    return (
      <Dropdown.Item unstyled data-testid={item.dataTestId} id={item.id}>
        {item.node}
      </Dropdown.Item>
    );
  }

  return (
    <Dropdown.Item
      data-testid={item.dataTestId}
      id={item.id}
      onAction={item.onAction}>
      <MenuRow
        icon={item.icon}
        isActive={item.isActive}
        label={item.label ?? ''}
        supportingText={item.supportingText}
      />
    </Dropdown.Item>
  );
};

// ─── AIUserMenu ───────────────────────────────────────────────────────────────

const AIUserMenu: React.FC<AIUserMenuProps> = ({ collapsed = false }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { onLogoutHandler } = useAuthProvider();
  const openPanel = usePersonalSpaceStore((state) => state.open);
  const { appVersion, currentUser, selectedPersona, setSelectedPersona } =
    useApplicationStore();

  const userExtras = currentUser as CurrentUserExtras | undefined;
  const displayName = useMemo(
    () =>
      currentUser?.displayName ??
      currentUser?.name ??
      currentUser?.email ??
      'User',
    [currentUser]
  );
  const email = useMemo(
    () => currentUser?.email ?? currentUser?.name ?? '',
    [currentUser]
  );
  const currentLocale = i18n.language ?? '';
  const currentLanguage = currentLocale
    ? upperCase(currentLocale.split('-')[0])
    : 'EN';

  const selectedPersonaName = selectedPersona
    ? getEntityName(selectedPersona) ?? 'Default'
    : 'Default';

  const userRole = useMemo(() => {
    if (currentUser?.isAdmin) {
      return 'Admin';
    }
    const roles = userExtras?.roles ?? [];

    return roles.length > 0 ? roles[0].displayName ?? roles[0].name ?? '' : '';
  }, [currentUser, userExtras]);

  const allPersonas: EntityReference[] = useMemo(() => {
    const combined = [
      ...(currentUser?.personas ?? []),
      ...(currentUser?.inheritedPersonas ?? []),
    ];
    if (currentUser?.defaultPersona) {
      combined.push(currentUser.defaultPersona);
    }
    const seen = new Map<string, EntityReference>();
    combined.forEach((p) => {
      if (p.id) {
        seen.set(p.id, p);
      }
    });

    return Array.from(seen.values());
  }, [currentUser]);

  const handleHelpItemAction = useCallback(
    (item: SupportItem) => {
      if (item.handleSupportItemClick) {
        return () => item.handleSupportItemClick?.();
      }
      if (item.isExternal) {
        return () =>
          window.open(
            item.link?.replace('{{currentVersion}}', appVersion ?? ''),
            '_blank',
            'noopener,noreferrer'
          );
      }
      if (item.link) {
        return () => navigate(item.link as string);
      }

      return undefined;
    },
    [appVersion, navigate]
  );

  const handleLanguageChange = useCallback(
    async (key: string) => {
      await localUtilClassBase.loadLocales(key);
      await i18n.changeLanguage(key);
      navigate(0);
    },
    [navigate]
  );

  const menuItems: MenuItemConfig[] = useMemo(
    () => [
      {
        type: 'item',
        id: 'persona',
        icon: User01,
        label: t('label.persona'),
        supportingText: selectedPersonaName,
        children: allPersonas.map((p) => ({
          type: 'item' as const,
          id: p.id ?? p.name ?? '',
          icon: User01,
          label: getEntityName(p) ?? p.name ?? '',
          isActive: selectedPersona?.id === p.id,
          onAction: () => setSelectedPersona(p),
        })),
      },
      { type: 'separator', id: 'sep-1' },
      {
        type: 'item',
        id: 'help',
        icon: HelpCircle,
        label: t('label.help'),
        children: navbarUtilClassBase
          .getHelpItems()
          .map((item: SupportItem) => ({
            type: 'item' as const,
            id: `help-${item.key}`,
            icon: item.icon,
            label:
              item.key === HELP_ITEMS_ENUM.VERSION && appVersion
                ? t('label.version-number', { version: appVersion })
                : t(item.label),
            onAction: handleHelpItemAction(item),
          })),
      },
      {
        type: 'item',
        id: 'language',
        icon: File06,
        label: t('label.language'),
        supportingText: currentLanguage,
        onAction: (key) => {
          if (key) {
            handleLanguageChange(key);
          }
        },
        children: languageSelectOptions.map((opt) => ({
          type: 'item' as const,
          id: opt.key,
          label: opt.label,
          isActive: currentLocale === opt.key,
        })),
      },
      { type: 'separator', id: 'sep-2' },
      {
        type: 'item',
        id: 'settings',
        dataTestId: 'ask-user-menu-settings',
        icon: Settings01,
        label: t('label.setting-plural'),
        onAction: () => {
          navigate('/settings');
        },
      },
      { type: 'separator', id: 'sep-3' },
      {
        type: 'item',
        id: 'logout',
        icon: ArrowRight,
        label: t('label.logout'),
        onAction: () => onLogoutHandler(),
      },
    ],
    [
      allPersonas,
      appVersion,
      currentLanguage,
      currentLocale,
      handleHelpItemAction,
      handleLanguageChange,
      navigate,
      onLogoutHandler,
      openPanel,
      selectedPersona,
      selectedPersonaName,
      setSelectedPersona,
      t,
    ]
  );

  return (
    <Dropdown.Root>
      <Button
        aria-label={getEntityName(currentUser) ?? ''}
        className={classNames(
          'tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:overflow-hidden tw:rounded-[10px] tw:p-0',
          {
            'tw:bg-primary tw:w-full': !collapsed,
          }
        )}
        data-testid="ask-ai-user-menu-trigger">
        <ProfilePicture displayName={displayName} name={email} width="40" />
        {!collapsed && (
          <Box
            align="start"
            className="tw:min-w-0 tw:overflow-hidden"
            direction="col"
            gap={1}>
            <Typography
              className="tw:truncate tw:text-primary"
              weight="semibold">
              {displayName}
            </Typography>
            <Typography
              className="tw:truncate tw:text-tertiary"
              weight="regular">
              {selectedPersonaName}
            </Typography>
          </Box>
        )}
      </Button>

      <Dropdown.Popover className="tw:w-62" placement="right bottom">
        <Dropdown.Menu>
          <MenuItem
            className="tw:group tw:block tw:cursor-pointer tw:px-1.5 tw:py-px tw:outline-hidden"
            data-testid="ai-user-menu-profile"
            id="profile-header"
            textValue={displayName}
            onAction={() => openPanel('profile')}>
            <Box
              align="center"
              className="tw:relative tw:rounded-md tw:px-2.5 tw:py-2 tw:transition tw:duration-100 tw:ease-linear tw:group-hover:bg-primary_hover"
              gap={3}>
              <ProfilePicture
                displayName={displayName}
                name={email}
                width="40"
              />
              <Box
                className="tw:min-w-0 tw:flex-1 tw:overflow-hidden"
                direction="col">
                <Typography
                  className="tw:truncate tw:text-primary"
                  weight="semibold">
                  {displayName}
                </Typography>
                {userRole && (
                  <Typography
                    className="tw:truncate tw:text-tertiary"
                    weight="regular">
                    {userRole}
                  </Typography>
                )}
              </Box>
              <ArrowUpRight
                className="tw:shrink-0 tw:text-secondary tw:rotate-25"
                height={14}
                width={14}
              />
            </Box>
          </MenuItem>
          <Dropdown.Separator />
          {menuItems.map((item) => (
            <MenuItemRenderer item={item} key={item.id} />
          ))}
        </Dropdown.Menu>
        <Box className="tw:border-t tw:border-secondary tw:px-4 tw:py-3">
          <ThemeModeSwitcher className="tw:w-full" />
        </Box>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default AIUserMenu;
