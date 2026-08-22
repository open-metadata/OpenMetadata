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
import {
  useAppModeSidebarHeader,
  useAppModeSidebarMainFooter,
} from '../appModeExtensions';
import { handleNavItemClick, MainNavItem, resolveNavHref } from './navConfig';
import NavItem from './NavItem';
import { useActiveNavKey } from './useActiveNavKey';
import { ReactComponent as CollapsePanelIcon } from '../../../../assets/svg/collapse-panel.svg';

export interface MainPanelProps {
  onCollapse: () => void;
  /** Ordered top-level nav items derived from the merged module list. */
  items: MainNavItem[];
}

const MainPanel: React.FC<MainPanelProps> = ({ onCollapse, items }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const activeItemKey = useActiveNavKey();
  const headerSlots = useAppModeSidebarHeader();
  const footerSlots = useAppModeSidebarMainFooter();

  const handleItemClick = useCallback(
    (item: MainNavItem) => handleNavItemClick({ item, navigate }),
    [navigate]
  );

  return (
    <div className="ask-main-panel" data-testid="ask-main-panel">
      <header className="ask-main-panel__header">
        <div className="ask-main-panel__header-brand">
          {headerSlots.map(({ key, component: Slot }) => (
            <Slot key={key} />
          ))}
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
        {items.map((item) => {
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

      <div className="ask-main-panel__footer">
        {footerSlots.map(({ key, component: Slot }) => (
          <Slot key={key} />
        ))}
      </div>
    </div>
  );
};

export default MainPanel;
