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

import classNames from 'classnames';
import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Intent, SubNavConfig } from '../AppModule.types';
import { useAllAppModules } from '../sharedAppModules';
import { useActiveModuleStore } from '../state/useActiveModule';
import { emitIntent } from '../useIntent';
import ContextCenterSubNavSections from './ContextCenterSubNavSections';
import MainPanel from './MainPanel';
import { buildMainNavItems, resolveActiveSubNavKey } from './navConfig';
import Rail, { RailItem } from './Rail';
import './sidebar.less';
import SubPanel from './SubPanel';
import SubRail from './SubRail';
import { useCustomizedMainNav } from './useCustomizedMainNav';

// Sub-nav config key for the Context Center module — its sub-panel carries
// the dynamic Quick Actions / Recently Viewed / Bookmarks sections below the
// static nav items.
const CONTEXT_CENTER_SUBNAV_KEY = 'context-center';

const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const modules = useAllAppModules();

  const [collapsed, setCollapsed] = useState(false);
  // Submenus start collapsed (sub-rail) and open only when the user explicitly
  // expands them — navigating into a sub-mode module must not pop the panel.
  const [subCollapsed, setSubCollapsed] = useState(true);

  const mainNavItems = useMemo(() => buildMainNavItems(modules), [modules]);

  // Apply the selected persona's sidebar customization (order + visibility +
  // top-level/More split) to the module-derived nav items.
  const { nodes: mainNavNodes } = useCustomizedMainNav(mainNavItems);

  // Derive the sub-nav from the STICKY active module (kept in sync with the URL
  // by `useSyncActiveModule`), not the raw pathname: module-less shared pages
  // (e.g. `/table/<fqn>`) retain the last module so the sub-nav stays open
  // mid-flow instead of collapsing.
  const activeModuleId = useActiveModuleStore((s) => s.activeModule);

  const activeSubNav: SubNavConfig | null = useMemo(() => {
    const activeModule = activeModuleId
      ? modules.find((m) => m.id === activeModuleId)
      : undefined;

    return activeModule?.subNav ?? null;
  }, [activeModuleId, modules]);

  const inSubMode = activeSubNav !== null;
  const isContextCenter = activeSubNav?.key === CONTEXT_CENTER_SUBNAV_KEY;

  const handleUploadFile = useCallback(() => emitIntent(Intent.UploadFile), []);
  const handleCreateArticle = useCallback(
    () => emitIntent(Intent.CreateArticle),
    []
  );
  const handleAddQuickLink = useCallback(
    () => emitIntent(Intent.AddQuickLink),
    []
  );

  // Context Center's sub-panel appends dynamic Quick Actions / Recently
  // Viewed / Bookmarks sections beneath its static nav items.
  const dynamicSections = isContextCenter ? (
    <ContextCenterSubNavSections
      enabled={isContextCenter}
      onAddQuickLink={handleAddQuickLink}
      onCreateArticle={handleCreateArticle}
      onUploadFile={handleUploadFile}
    />
  ) : undefined;

  // Collapsed/expanded state (both main and sub) is purely user-controlled via
  // the explicit toggle handlers below — navigating to a route never changes
  // it, otherwise every click into a submenu item would rail the main nav / pop
  // the submenu open on its own.

  const showRail = collapsed;
  const showSubPanel = inSubMode && !subCollapsed;
  const showSubRail = inSubMode && subCollapsed;

  const handleToggleMain = useCallback(() => {
    setCollapsed((prev) => {
      if (prev) {
        // Expanding main → collapse sub so only one panel is open.
        setSubCollapsed(true);
      }

      return !prev;
    });
  }, []);

  const handleToggleSub = useCallback(() => {
    setSubCollapsed((prev) => {
      if (prev) {
        // Expanding sub → collapse main so only one panel is open.
        setCollapsed(true);
      }

      return !prev;
    });
  }, []);

  const subRailItems: RailItem[] = useMemo(() => {
    if (!activeSubNav) {
      return [];
    }
    const activeKey = resolveActiveSubNavKey(
      activeSubNav.sections,
      pathname,
      state
    );

    return activeSubNav.sections
      .flatMap((section) => section.items)
      .flatMap((item) => {
        const icon = item.railIcon ?? item.icon;
        if (!icon) {
          return [];
        }

        const railItem: RailItem = {
          key: item.key,
          icon,
          activeIcon: item.railActiveIcon ?? item.activeIcon,
          label: t(item.railLabelKey ?? item.labelKey),
          href: item.path,
          onClick: () => item.path && navigate(item.path),
          isActive: activeKey === item.key,
        };

        return [railItem];
      });
  }, [activeSubNav, pathname, state, navigate, t]);

  return (
    <div
      className={classNames('ask-sidebar', {
        'ask-sidebar--collapsed': collapsed,
        'ask-sidebar--sub': inSubMode,
        'ask-sidebar--sub-collapsed': subCollapsed,
      })}
      data-testid="ask-sidebar">
      <MainPanel nodes={mainNavNodes} onCollapse={handleToggleMain} />
      {showRail ? (
        <Rail nodes={mainNavNodes} onToggle={handleToggleMain} />
      ) : null}
      {showSubPanel && activeSubNav ? (
        <SubPanel
          config={activeSubNav}
          dynamicSections={dynamicSections}
          onCollapse={handleToggleSub}
        />
      ) : null}
      {showSubRail ? (
        <SubRail items={subRailItems} onExpand={handleToggleSub} />
      ) : null}
    </div>
  );
};

export default Sidebar;
