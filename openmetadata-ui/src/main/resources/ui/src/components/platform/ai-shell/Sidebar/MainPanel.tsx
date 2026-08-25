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

import { ButtonUtility } from '@openmetadata/ui-core-components';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as CollapsePanelIcon } from '../../../../assets/svg/collapse-panel.svg';
import {
    useAppModeSidebarHeader,
    useAppModeSidebarMainFooter,
    useAppModeSidebarRecent
} from '../appModeExtensions';
import MoreNavPopover from './MoreNavPopover';
import { handleNavItemClick, MainNavItem, resolveNavHref } from './navConfig';
import NavItem from './NavItem';
import SidebarBrand from './SidebarBrand';
import { MainNavNode } from './sidebarCustomization';
import { useActiveNavKey } from './useActiveNavKey';
import UserProfileCard from './UserProfileCard';

export interface MainPanelProps {
  onCollapse: () => void;
  /**
   * Ordered top-level render nodes — regular items plus the "More" overflow
   * group — after the persona's sidebar customization has been applied.
   */
  nodes: MainNavNode[];
}

const MainPanel: React.FC<MainPanelProps> = ({ onCollapse, nodes }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeItemKey = useActiveNavKey();
  const headerSlots = useAppModeSidebarHeader();
  const footerSlots = useAppModeSidebarMainFooter();
  const recentSlots = useAppModeSidebarRecent();

  const handleItemClick = useCallback(
    (item: MainNavItem) => handleNavItemClick({ item, navigate }),
    [navigate]
  );

  return (
    <div className="ask-main-panel" data-testid="ask-main-panel">
      <header className="ask-main-panel__header">
        <div className="ask-main-panel__header-brand">
          {headerSlots.length > 0 ? (
            headerSlots.map(({ key, component: Slot }) => <Slot key={key} />)
          ) : (
            <SidebarBrand />
          )}
        </div>
        <div className="ask-main-panel__header-actions">
          <ButtonUtility
            className="ask-main-panel__collapse-btn"
            color="tertiary"
            data-testid="ask-collapse-btn"
            icon={CollapsePanelIcon}
            size="sm"
            tooltip={t('label.collapse')}
            type="button"
            onClick={onCollapse}
          />
        </div>
      </header>

      <nav className="ask-main-panel__nav">
        {nodes.map((node) => {
          if (node.type === 'more') {
            return (
              <MoreNavPopover
                items={node.children}
                key="more"
                variant="panel"
              />
            );
          }

          const { item } = node;
          // Navigable items render as anchors (href) so the browser's
          // open-in-new-tab affordances work; action-only items keep their
          // click handler.
          const href = resolveNavHref(item.action);

          return (
            <NavItem
              active={activeItemKey === item.key}
              activeIcon={item.activeIcon}
              badge={item.badgeKey ? t(item.badgeKey) : undefined}
              dataTestId={`ask-nav-item-${item.key}`}
              href={href}
              icon={item.icon}
              key={item.key}
              label={t(item.labelKey)}
              onClick={href ? undefined : () => handleItemClick(item)}
            />
          );
        })}
      </nav>

      {recentSlots.length > 0 ? (
        <div className="ask-main-panel__chats" data-testid="ask-recent-region">
          {recentSlots.map(({ key, component: Slot }) => (
            <Slot key={key} />
          ))}
        </div>
      ) : null}

      <div className="ask-main-panel__footer">
        {footerSlots.length > 0 ? (
          footerSlots.map(({ key, component: Slot }) => <Slot key={key} />)
        ) : (
          <UserProfileCard />
        )}
      </div>
    </div>
  );
};

export default MainPanel;
