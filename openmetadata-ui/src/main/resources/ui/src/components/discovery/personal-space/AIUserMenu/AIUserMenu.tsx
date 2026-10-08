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

import {
  Avatar,
  Box,
  Dropdown,
  FeaturedIcon,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  ChevronSelectorVertical,
  Database01,
  Globe01,
  HelpCircle,
  Language,
  Lightbulb01,
  LogOut01,
  Settings01,
  User01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, { FC, ReactNode, useCallback, useEffect, useMemo } from 'react';
import { Button, SubmenuTrigger } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthProvider } from '../../../../components/Auth/AuthProviders/AuthProvider';
import ProfilePicture from '../../../../components/common/ProfilePicture/ProfilePicture';
import {
  HELP_ITEMS_ENUM,
  SupportItem,
} from '../../../../constants/Navbar.constants';
import { useTheme } from '../../../../context/UntitledUIThemeProvider/theme-provider';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useDomainStore } from '../../../../hooks/useDomainStore';
import { usePersonalSpaceStore } from '../../../../hooks/usePersonalSpaceStore';
import { useSettingsHash } from '../../../../hooks/useSettingsHash';
import { getVersion } from '../../../../rest/miscAPI';
import {
  getDomainDisplayName,
  getEntityName,
} from '../../../../utils/EntityNameUtils';
import { languageSelectOptions } from '../../../../utils/i18next/i18nextUtil';
import i18n from '../../../../utils/i18next/LocalUtil';
import localUtilClassBase from '../../../../utils/i18next/LocalUtilClassBase';
import navbarUtilClassBase from '../../../../utils/NavbarUtilClassBase';
import DomainScopeControl from '../../../common/DomainScopeControl/DomainScopeControl';
import { AIUserMenuProps } from './AIUserMenu.interface';
import { getLanguageName, getUserPersonas } from './AIUserMenu.utils';

const SUBMENU_LIST_CLASS = 'tw:max-h-72 tw:overflow-y-auto';

const ICON_CLASS = 'tw:size-4 tw:shrink-0';

const MUTED_ICON_CLASS = `${ICON_CLASS} tw:text-fg-quaternary`;

type IconComponent = FC<{ className?: string }>;

interface MenuRowProps {
  icon: IconComponent;
  label: string;
  /** Current value shown before the chevron, e.g. the active language. */
  value?: string;
  hasSubmenu?: boolean;
  isDanger?: boolean;
}

const MenuRow = ({
  icon: Icon,
  label,
  value,
  hasSubmenu,
  isDanger,
}: MenuRowProps) => (
  <Box align="center" gap={3}>
    <Icon
      aria-hidden
      className={
        isDanger
          ? classNames(ICON_CLASS, 'tw:text-fg-error-primary')
          : MUTED_ICON_CLASS
      }
    />
    <span
      className={classNames(
        'tw:flex-1 tw:truncate',
        isDanger ? 'tw:text-error-primary' : 'tw:text-secondary'
      )}>
      {label}
    </span>
    {value && <span className="tw:shrink-0 tw:text-tertiary">{value}</span>}
    {hasSubmenu && <ChevronRight aria-hidden className={MUTED_ICON_CLASS} />}
  </Box>
);

/** Domain / persona row: icon tile, caption over the current value, chevron. */
const ContextRow = ({
  icon,
  caption,
  value,
}: {
  icon: IconComponent;
  caption: string;
  value?: string;
}) => (
  // Full width: the domain row sits inside the picker's flex trigger wrapper.
  <Box align="center" className="tw:w-full" gap={3}>
    <FeaturedIcon color="brand" icon={icon} shape="square" size="sm" />
    <Box className="tw:min-w-0 tw:flex-1" direction="col">
      <Typography className="tw:text-tertiary" size="text-xs">
        {caption}
      </Typography>
      <Typography className="tw:truncate tw:text-primary" weight="semibold">
        {value}
      </Typography>
    </Box>
    <ChevronRight aria-hidden className={MUTED_ICON_CLASS} />
  </Box>
);

const OptionRow = ({
  label,
  isSelected,
  leading,
}: {
  label: string;
  isSelected: boolean;
  leading?: ReactNode;
}) => (
  <Box align="center" gap={2}>
    {leading}
    <span className="tw:flex-1 tw:truncate">{label}</span>
    {isSelected && (
      <Check
        aria-hidden
        className={classNames(ICON_CLASS, 'tw:text-fg-brand-primary')}
      />
    )}
  </Box>
);

const AIUserMenu: React.FC<AIUserMenuProps> = ({ collapsed = false }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { onLogoutHandler } = useAuthProvider();
  const { setHash } = useSettingsHash();
  const { theme, setTheme } = useTheme();
  const openPanel = usePersonalSpaceStore((state) => state.open);
  const { activeDomain, activeDomainEntityRef } = useDomainStore();
  const {
    appVersion,
    currentUser,
    selectedPersona,
    setAppVersion,
    setSelectedPersona,
  } = useApplicationStore();

  useEffect(() => {
    if (!appVersion) {
      getVersion()
        .then((res) => setAppVersion(res.version.replace('-SNAPSHOT', '')))
        .catch(() => {
          // version display is non-critical
        });
    }
  }, [appVersion, setAppVersion]);

  const displayName = getEntityName(currentUser) || t('label.user');
  const email = currentUser?.email ?? '';
  const domainDisplayName = getDomainDisplayName(
    activeDomainEntityRef,
    activeDomain
  );
  const selectedPersonaName = selectedPersona
    ? getEntityName(selectedPersona)
    : t('label.default');
  const userRole = currentUser?.isAdmin
    ? t('label.admin')
    : getEntityName(currentUser?.roles?.[0]);
  const currentLocale = i18n.language;
  const allPersonas = useMemo(
    () => getUserPersonas(currentUser),
    [currentUser]
  );

  const handleHelpItemAction = useCallback(
    (item: SupportItem) => {
      if (item.handleSupportItemClick) {
        item.handleSupportItemClick();
      } else if (item.isExternal) {
        window.open(
          item.link?.replace('{{currentVersion}}', appVersion ?? ''),
          '_blank',
          'noopener,noreferrer'
        );
      } else if (item.link) {
        navigate(item.link);
      }
    },
    [appVersion, navigate]
  );

  const handleLanguageChange = useCallback(
    async (locale: string) => {
      await localUtilClassBase.loadLocales(locale);
      await i18n.changeLanguage(locale);
      navigate(0);
    },
    [navigate]
  );

  return (
    <Dropdown.Root>
      <Tooltip
        arrow
        description={domainDisplayName}
        isDisabled={!collapsed}
        placement="right"
        title={displayName}>
        <Button
          aria-label={displayName}
          className={classNames(
            'tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:text-left tw:outline-focus-ring tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2',
            collapsed ? 'tw:rounded-full' : 'tw:min-w-0 tw:flex-1 tw:rounded-md'
          )}
          data-testid="ask-ai-user-menu-trigger">
          <ProfilePicture displayName={displayName} name={email} size="sm" />
          {!collapsed && (
            <>
              <Box className="tw:min-w-0 tw:flex-1" direction="col">
                <Typography
                  className="tw:truncate tw:text-primary"
                  weight="semibold">
                  {displayName}
                </Typography>
                <Box align="center" className="tw:min-w-0" gap={1}>
                  <Globe01
                    aria-hidden
                    className="tw:size-3 tw:shrink-0 tw:text-fg-quaternary"
                  />
                  <Typography
                    className="tw:truncate tw:text-tertiary"
                    data-testid="ask-ai-user-menu-domain"
                    size="text-xs">
                    {domainDisplayName}
                  </Typography>
                </Box>
              </Box>
              <ChevronSelectorVertical
                aria-hidden
                className={MUTED_ICON_CLASS}
              />
            </>
          )}
        </Button>
      </Tooltip>

      <Dropdown.Popover className="tw:w-72" placement="right bottom">
        <Dropdown.Menu selectionMode="none">
          <Dropdown.Item
            data-testid="ai-user-menu-profile"
            id="profile"
            textValue={displayName}
            onAction={() =>
              setHash(
                'profile',
                currentUser?.name
                  ? encodeURIComponent(currentUser.name)
                  : undefined
              )
            }>
            <Box align="center" gap={3}>
              <ProfilePicture
                displayName={displayName}
                name={email}
                width="40"
              />
              <Box className="tw:min-w-0 tw:flex-1" direction="col">
                <Typography
                  className="tw:truncate tw:text-primary"
                  weight="semibold">
                  {displayName}
                </Typography>
                {userRole && (
                  <Typography className="tw:truncate tw:text-tertiary">
                    {userRole}
                  </Typography>
                )}
              </Box>
              <ArrowUpRight aria-hidden className={MUTED_ICON_CLASS} />
            </Box>
          </Dropdown.Item>

          <Dropdown.Separator />

          <DomainScopeControl>
            <ContextRow
              caption={t('label.domain-scope')}
              icon={Globe01}
              value={domainDisplayName}
            />
          </DomainScopeControl>

          <SubmenuTrigger>
            <Dropdown.Item
              data-testid="ai-user-menu-persona"
              id="persona"
              textValue={t('label.active-persona')}>
              <ContextRow
                caption={t('label.active-persona')}
                icon={User01}
                value={selectedPersonaName}
              />
            </Dropdown.Item>
            <Dropdown.Popover placement="right top">
              <Dropdown.Menu
                className={SUBMENU_LIST_CLASS}
                selectedKeys={selectedPersona ? [selectedPersona.id] : []}>
                <Dropdown.Section>
                  <Dropdown.SectionHeader className="tw:flex tw:flex-col tw:px-4 tw:pt-2 tw:pb-1">
                    <Typography className="tw:text-primary" weight="semibold">
                      {t('label.switch-persona')}
                    </Typography>
                    <Typography className="tw:text-tertiary" size="text-xs">
                      {t('message.persona-switch-description')}
                    </Typography>
                  </Dropdown.SectionHeader>
                  {allPersonas.map((persona) => {
                    const personaName = getEntityName(persona);

                    return (
                      <Dropdown.Item
                        data-testid={`ai-user-menu-persona-${persona.name}`}
                        id={persona.id}
                        key={persona.id}
                        textValue={personaName}
                        onAction={() => setSelectedPersona(persona)}>
                        {({ isSelected }) => (
                          <OptionRow
                            isSelected={isSelected}
                            label={personaName}
                            leading={
                              <Avatar
                                colorVariant={isSelected ? 'solid' : 'neutral'}
                                initials={personaName.charAt(0).toUpperCase()}
                                size="xs"
                              />
                            }
                          />
                        )}
                      </Dropdown.Item>
                    );
                  })}
                </Dropdown.Section>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </SubmenuTrigger>

          <Dropdown.Separator />

          <Dropdown.Item
            data-testid="ai-user-menu-my-data"
            id="my-data"
            textValue={t('label.my-data')}
            onAction={() => openPanel('my-data')}>
            <MenuRow icon={Database01} label={t('label.my-data')} />
          </Dropdown.Item>

          <SubmenuTrigger>
            <Dropdown.Item id="help" textValue={t('label.help')}>
              <MenuRow hasSubmenu icon={HelpCircle} label={t('label.help')} />
            </Dropdown.Item>
            <Dropdown.Popover placement="right top">
              <Dropdown.Menu
                className={SUBMENU_LIST_CLASS}
                selectionMode="none">
                {navbarUtilClassBase.getHelpItems().map((item) => (
                  <Dropdown.Item
                    icon={item.icon}
                    id={item.key}
                    key={item.key}
                    label={
                      item.key === HELP_ITEMS_ENUM.VERSION && appVersion
                        ? t('label.version-number', { version: appVersion })
                        : t(item.label)
                    }
                    onAction={() => handleHelpItemAction(item)}
                  />
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </SubmenuTrigger>

          <SubmenuTrigger>
            <Dropdown.Item id="language" textValue={t('label.language')}>
              <MenuRow
                hasSubmenu
                icon={Language}
                label={t('label.language')}
                value={getLanguageName(currentLocale)}
              />
            </Dropdown.Item>
            <Dropdown.Popover placement="right top">
              <Dropdown.Menu
                className={SUBMENU_LIST_CLASS}
                selectedKeys={[currentLocale]}>
                {languageSelectOptions.map((option) => (
                  <Dropdown.Item
                    id={option.key}
                    key={option.key}
                    textValue={option.label}
                    onAction={() => handleLanguageChange(option.key)}>
                    {({ isSelected }) => (
                      <OptionRow isSelected={isSelected} label={option.label} />
                    )}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </SubmenuTrigger>

          <Dropdown.Item
            data-testid="ask-user-menu-settings"
            id="settings"
            textValue={t('label.setting-plural')}
            onAction={() => navigate('/settings')}>
            <MenuRow icon={Settings01} label={t('label.setting-plural')} />
          </Dropdown.Item>

          <SubmenuTrigger>
            <Dropdown.Item
              data-testid="ai-user-menu-appearance"
              id="appearance"
              textValue={t('label.appearance')}>
              <MenuRow
                hasSubmenu
                icon={Lightbulb01}
                label={t('label.appearance')}
                value={theme === 'dark' ? t('label.dark') : t('label.light')}
              />
            </Dropdown.Item>
            <Dropdown.Popover placement="right top">
              <Dropdown.Menu selectedKeys={[theme]}>
                <Dropdown.Item
                  data-testid="ai-user-menu-theme-light"
                  id="light"
                  textValue={t('label.light')}
                  onAction={() => setTheme('light')}>
                  {({ isSelected }) => (
                    <OptionRow
                      isSelected={isSelected}
                      label={t('label.light')}
                    />
                  )}
                </Dropdown.Item>
                <Dropdown.Item
                  data-testid="ai-user-menu-theme-dark"
                  id="dark"
                  textValue={t('label.dark')}
                  onAction={() => setTheme('dark')}>
                  {({ isSelected }) => (
                    <OptionRow
                      isSelected={isSelected}
                      label={t('label.dark')}
                    />
                  )}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </SubmenuTrigger>

          <Dropdown.Item
            data-testid="ai-user-menu-logout"
            id="logout"
            textValue={t('label.logout')}
            onAction={onLogoutHandler}>
            <MenuRow isDanger icon={LogOut01} label={t('label.logout')} />
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default AIUserMenu;
