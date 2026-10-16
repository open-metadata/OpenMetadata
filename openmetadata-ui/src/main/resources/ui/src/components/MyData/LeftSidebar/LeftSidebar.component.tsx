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
import {
  Badge,
  Box,
  Button,
  ButtonUtility,
  Divider,
  Dropdown,
  NavItemBase,
  NavItemButton,
  SimpleModal,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  LOGOUT_ITEM,
  SETTING_ITEM,
} from '../../../constants/LeftSidebar.constants';
import { SidebarItem } from '../../../enums/sidebar.enum';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useSidebarItems } from '../../../hooks/useSidebarItems';
import { LeftSidebarItem as SidebarEntry } from '../../../interface/sidebar.interface';
import leftSidebarClassBase from '../../../utils/LeftSidebarClassBase';
import {
  getSidebarActiveKeys,
  getSidebarPathname,
} from '../../../utils/LeftSidebarUtils';
import { useAuthProvider } from '../../Auth/AuthProviders/AuthProvider';
import BrandImage from '../../common/BrandImage/BrandImage';
import './left-sidebar.less';

const LeftSidebar = () => {
  const location = useCustomLocation();
  const { t, i18n } = useTranslation();
  const { onLogoutHandler } = useAuthProvider();
  const [isConfirmLogoutModalOpen, setIsConfirmLogoutModalOpen] =
    useState(false);
  const {
    preferences: { isSidebarCollapsed },
  } = useCurrentUserPreferences();
  const isDirectionRTL = i18n.dir() === 'rtl';
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [collapsedMenuKey, setCollapsedMenuKey] = useState<string>();
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout>>();
  const collapsedPopover = useRef<HTMLDivElement>(null);
  const sideBarItems = useSidebarItems();
  const selectedKeys = useMemo(
    () =>
      getSidebarActiveKeys(
        getSidebarPathname(location.pathname, location.state),
        leftSidebarClassBase.getSidebarNestedKeys()
      ),
    [location.pathname, location.state]
  );
  const handleLogoutClick = useCallback(
    () => setIsConfirmLogoutModalOpen(true),
    []
  );
  const hideConfirmLogoutModal = () => setIsConfirmLogoutModalOpen(false);

  const cancelHoverClose = () => {
    if (hoverCloseTimer.current !== undefined) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = undefined;
    }
  };

  useEffect(() => {
    setCollapsedMenuKey(undefined);

    return () => {
      if (hoverCloseTimer.current !== undefined) {
        clearTimeout(hoverCloseTimer.current);
      }
    };
  }, [isSidebarCollapsed]);

  const navigateToItem = (item: SidebarEntry, parentKey?: string) => {
    setOpenKeys(parentKey ? [parentKey] : []);
    // App-mode changes must run before the router follows this item's link.
    item.onClick?.();
  };

  const toggleGroup = (groupKey: string, isOpen: boolean) => {
    const otherKeys = (keys: string[]) =>
      keys.filter((key) => key !== groupKey);
    setOpenKeys((keys) =>
      isOpen ? [...otherKeys(keys), groupKey] : otherKeys(keys)
    );
  };

  const renderLeaf = (item: SidebarEntry, parentKey?: string) => {
    if (!item.redirect_url) {
      return (
        <Button
          aria-label={t(item.title)}
          color="tertiary"
          data-testid={item.dataTestId}
          iconLeading={item.icon}
          size="md"
          onPress={() => {
            navigateToItem(item, parentKey);
            if (item.key === SidebarItem.LOGOUT) {
              handleLogoutClick();
            }
          }}>
          {!isSidebarCollapsed && t(item.title)}
        </Button>
      );
    }

    if (isSidebarCollapsed) {
      return (
        <span
          className="tw:flex tw:justify-center"
          data-testid={item.dataTestId}>
          <NavItemButton
            current={selectedKeys.includes(item.key)}
            href={item.redirect_url}
            icon={item.icon}
            label={t(item.title)}
            onClick={() => navigateToItem(item, parentKey)}
          />
        </span>
      );
    }

    return (
      <NavItemBase
        badge={
          item.isBeta ? (
            <Badge color="brand" size="xs">
              {t('label.beta')}
            </Badge>
          ) : undefined
        }
        current={selectedKeys.includes(item.key)}
        dataTestId={item.dataTestId}
        href={item.redirect_url}
        icon={item.icon}
        truncate={false}
        type={parentKey ? 'collapsible-child' : 'link'}
        onClick={() => navigateToItem(item, parentKey)}>
        {t(item.title)}
      </NavItemBase>
    );
  };

  const renderGroup = (item: SidebarEntry) => {
    if (isSidebarCollapsed) {
      return (
        <Dropdown.Root
          isOpen={collapsedMenuKey === item.key}
          onOpenChange={(isOpen) =>
            setCollapsedMenuKey(isOpen ? item.key : undefined)
          }>
          <span
            className="tw:flex tw:h-10 tw:items-center tw:justify-center"
            role="presentation"
            onMouseEnter={() => {
              cancelHoverClose();
              setCollapsedMenuKey(item.key);
            }}
            onMouseLeave={() => {
              // A short handoff lets the pointer reach the portal without closing it mid-flight.
              cancelHoverClose();
              hoverCloseTimer.current = setTimeout(() => {
                if (
                  !collapsedPopover.current?.contains(document.activeElement)
                ) {
                  setCollapsedMenuKey(undefined);
                }
              }, 150);
            }}>
            <ButtonUtility
              aria-label={t(item.title)}
              color={
                item.children?.some((child) => selectedKeys.includes(child.key))
                  ? 'secondary'
                  : 'tertiary'
              }
              data-testid={item.dataTestId}
              icon={item.icon}
              size="sm"
              // Hover has already opened the group before a pointer press reaches its trigger.
              onPress={() => setCollapsedMenuKey(item.key)}
            />
          </span>
          {/* Hover menus must leave their triggers and neighbouring groups interactive. */}
          <Dropdown.Popover
            isNonModal
            placement={isDirectionRTL ? 'left top' : 'right top'}>
            <div
              ref={collapsedPopover}
              role="presentation"
              onMouseEnter={cancelHoverClose}
              onMouseLeave={() => setCollapsedMenuKey(undefined)}>
              <Dropdown.Menu
                aria-label={t(item.title)}
                selectedKeys={new Set(selectedKeys)}>
                {item.children?.map((child) => (
                  <Dropdown.Item
                    data-testid={child.dataTestId}
                    href={child.redirect_url}
                    icon={child.icon}
                    id={child.key}
                    key={child.key}
                    label={t(child.title)}
                    onAction={() => navigateToItem(child, item.key)}
                  />
                ))}
              </Dropdown.Menu>
            </div>
          </Dropdown.Popover>
        </Dropdown.Root>
      );
    }

    return (
      <details
        open={openKeys.includes(item.key)}
        onToggle={(event) => toggleGroup(item.key, event.currentTarget.open)}>
        <NavItemBase
          current={item.children?.some((child) =>
            selectedKeys.includes(child.key)
          )}
          icon={item.icon}
          truncate={false}
          type="collapsible">
          <span data-testid={item.dataTestId}>{t(item.title)}</span>
        </NavItemBase>
        <ul className="tw:m-0 tw:list-none tw:p-0">
          {item.children?.map((child) => (
            <li
              className="tw:py-0.5"
              data-testid={`side-bar-${child.dataTestId}`}
              key={child.key}>
              {renderLeaf(child, item.key)}
            </li>
          ))}
        </ul>
      </details>
    );
  };

  return (
    <aside
      className={classNames('app-sidebar tw:bg-surface', {
        'sidebar-collapsed': isSidebarCollapsed,
        'left-sidebar-col-rtl': isDirectionRTL,
        'sidebar-open': !isSidebarCollapsed,
        'tw:w-18 tw:min-w-18 tw:max-w-18': isSidebarCollapsed,
        'tw:w-57 tw:min-w-57 tw:max-w-57': !isSidebarCollapsed,
      })}
      data-testid="left-sidebar"
      dir={i18n.dir()}>
      <div className="logo-container">
        <Link className="flex-shrink-0" id="openmetadata_logo" to="/">
          <BrandImage
            className="vertical-middle h-full"
            dataTestId="image"
            height={40}
            isMonoGram={isSidebarCollapsed}
            width="auto"
          />
        </Link>
      </div>
      <div className="left-sidebar-layout">
        <Box className="menu-container" direction="col">
          <nav aria-label={t('label.navigation')} className="top-menu">
            <ul className="left-sidebar-menu tw:m-0 tw:list-none tw:px-3 tw:py-0">
              {sideBarItems.map((item) => (
                <li
                  className="tw:py-0.5"
                  data-testid={`side-bar-${item.dataTestId}`}
                  key={item.key}>
                  {item.children?.length ? renderGroup(item) : renderLeaf(item)}
                </li>
              ))}
            </ul>
          </nav>
          <nav
            aria-label={t('label.setting-plural')}
            className="bottom-menu tw:px-3">
            <Divider className="tw:my-2" />
            <ul className="tw:m-0 tw:list-none tw:p-0">
              {[SETTING_ITEM, LOGOUT_ITEM].map((item) => (
                <li key={item.key}>{renderLeaf(item)}</li>
              ))}
            </ul>
          </nav>
        </Box>
      </div>
      {isConfirmLogoutModalOpen && (
        <SimpleModal
          isOpen
          footer={
            <>
              <Button color="secondary" onClick={hideConfirmLogoutModal}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="confirm-logout"
                onClick={onLogoutHandler}>
                {t('label.logout')}
              </Button>
            </>
          }
          title={t('label.logout')}
          width={360}
          onCancel={hideConfirmLogoutModal}>
          <Typography color="secondary">
            {t('message.logout-confirmation')}
          </Typography>
        </SimpleModal>
      )}
    </aside>
  );
};

export default LeftSidebar;
