/*
 *  Copyright 2026 Collate.
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

import { Tooltip, TooltipTrigger } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import { Link as AriaLink } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as ExpandPanelIcon } from '../../../../assets/svg/expand-panel.svg';
import {
    useAppModeSidebarHeader,
    useAppModeSidebarRailFooter,
    useAppModeSidebarRecentRail
} from '../appModeExtensions';
import { IconComponent } from '../AppModule.types';
import MoreNavPopover from './MoreNavPopover';
import { MainNavItem } from './navConfig';
import SidebarBrand from './SidebarBrand';
import { MainNavNode } from './sidebarCustomization';
import { useActiveNavKey } from './useActiveNavKey';
import UserProfileCard from './UserProfileCard';

export interface RailItem {
  key: string;
  icon: IconComponent;
  activeIcon?: IconComponent;
  /** Icon shown while hovered */
  hoverIcon?: IconComponent;
  /** Icon shown while pressed, or while active if no `activeIcon` is set */
  pressedIcon?: IconComponent;
  /** Pre-translated text — used for tooltip and aria-label. */
  label: string;
  /**
   * Destination route. When set the item renders as an anchor (react-aria
   * `Link`) so the browser's open-in-new-tab affordances work and navigation
   * goes through the app's `RouterProvider`. When unset the item is a button
   * driven by `onClick`.
   */
  href?: string;
  onClick: () => void;
  isActive: boolean;
}

/** Interaction state shared by the react-aria Button and Link render props. */
interface RailIconState {
  isHovered: boolean;
  isPressed: boolean;
}

export interface RailProps {
  /**
   * Ordered top-level render nodes — regular items plus the "More" overflow
   * group — after the persona's sidebar customization has been applied.
   */
  nodes: MainNavNode[];
  onToggle: () => void;
}

/** Icon priority: pressed/active > active > hover > default. Exported for unit testing. */
export function resolveRailIcon(
  item: RailItem,
  state: { isHovered: boolean; isPressed: boolean }
): IconComponent {
  if ((state.isPressed || item.isActive) && item.pressedIcon) {
    return item.pressedIcon;
  }
  if (item.isActive && item.activeIcon) {
    return item.activeIcon;
  }
  if (state.isHovered && item.hoverIcon) {
    return item.hoverIcon;
  }

  return item.icon;
}

/**
 * A rail item's trigger. Navigable items (with an `href`) render as a
 * react-aria `Link` — a real `<a href>` so cmd/ctrl-click, middle-click and
 * the right-click "open in new tab" menu work, while plain clicks navigate
 * through the app's `RouterProvider`. Action-only items render as the
 * react-aria `TooltipTrigger` button driven by `onPress`.
 */
const RailNavButton: React.FC<{ item: RailItem }> = ({ item }) => {
  const hasInteractiveIcon = Boolean(item.hoverIcon || item.pressedIcon);

  const triggerClassName = ({ isHovered, isPressed }: RailIconState) =>
    classNames('ask-rail__item', {
      'ask-rail__item--active': item.isActive,
      'ask-rail__item--interactive-icon': hasInteractiveIcon,
      'ask-rail__item--is-hovered': hasInteractiveIcon && isHovered,
      'ask-rail__item--is-pressed': hasInteractiveIcon && isPressed,
    });

  const renderIcon = ({ isHovered, isPressed }: RailIconState) => {
    const Icon = resolveRailIcon(item, { isHovered, isPressed });

    return <Icon height={20} width={20} />;
  };

  return (
    <Tooltip arrow placement="right" title={item.label}>
      {item.href ? (
        <AriaLink
          aria-label={item.label}
          className={triggerClassName}
          data-testid={`ask-rail-item-${item.key}`}
          href={item.href}>
          {renderIcon}
        </AriaLink>
      ) : (
        <TooltipTrigger
          aria-label={item.label}
          className={triggerClassName}
          data-testid={`ask-rail-item-${item.key}`}
          onPress={item.onClick}>
          {renderIcon}
        </TooltipTrigger>
      )}
    </Tooltip>
  );
};

const Rail: React.FC<RailProps> = ({ nodes, onToggle }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeNavKey = useActiveNavKey();
  const headerSlots = useAppModeSidebarHeader();
  const footerSlots = useAppModeSidebarRailFooter();
  const recentSlots = useAppModeSidebarRecentRail();

  const toRailItem = (item: MainNavItem): RailItem => ({
    key: item.key,
    icon: item.collapsedIcon ?? item.icon,
    activeIcon: item.activeIcon,
    hoverIcon: item.hoverIcon,
    pressedIcon: item.pressedIcon,
    label: t(item.labelKey),
    href: item.action.path,
    onClick: () => navigate(item.action.path),
    isActive: activeNavKey === item.key,
  });

  return (
    <div className="ask-rail" data-testid="ask-rail">
      <div className="ask-rail__header">
        <div className="ask-rail__header-top">
          {headerSlots.length > 0 ? (
            headerSlots.map(({ key, component: Slot }) => <Slot key={key} />)
          ) : (
            <SidebarBrand variant="rail" />
          )}
          <button
            aria-label={t('label.expand')}
            className="ask-rail__expand-btn"
            data-testid="ask-rail-expand-btn"
            type="button"
            onClick={onToggle}>
            <ExpandPanelIcon height={20} width={20} />
          </button>
        </div>
      </div>

      <nav className="ask-rail__nav">
        {nodes.map((node) =>
          node.type === 'more' ? (
            <MoreNavPopover items={node.children} key="more" variant="rail" />
          ) : (
            <RailNavButton
              item={toRailItem(node.item)}
              key={node.item.key}
            />
          )
        )}
      </nav>

      {recentSlots.length > 0 ? (
        <div className="ask-rail__recent" data-testid="ask-rail-recent-region">
          {recentSlots.map(({ key, component: Slot }) => (
            <Slot key={key} />
          ))}
        </div>
      ) : null}

      <div className="ask-rail__profile">
        {footerSlots.length > 0 ? (
          footerSlots.map(({ key, component: Slot }) => <Slot key={key} />)
        ) : (
          <UserProfileCard compact />
        )}
      </div>
    </div>
  );
};

export default Rail;
