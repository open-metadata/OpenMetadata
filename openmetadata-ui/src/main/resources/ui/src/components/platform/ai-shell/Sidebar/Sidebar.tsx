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
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { SubNavConfig } from '../AppModule.types';
import { useAllAppModules } from '../sharedAppModules';
import { matchModuleByPathname } from '../state/useActiveModule';
import MainPanel from './MainPanel';
import { buildMainNavItems, resolveActiveSubNavKey } from './navConfig';
import Rail, { RailItem } from './Rail';
import './sidebar.less';
import SubPanel from './SubPanel';
import SubRail from './SubRail';
import { useCustomizedMainNav } from './useCustomizedMainNav';

const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const modules = useAllAppModules();

  const [collapsed, setCollapsed] = useState(false);
  const [subCollapsed, setSubCollapsed] = useState(false);

  const mainNavItems = useMemo(() => buildMainNavItems(modules), [modules]);

  // Apply the selected persona's sidebar customization (order + visibility +
  // top-level/More split) to the module-derived nav items.
  const { nodes: mainNavNodes } = useCustomizedMainNav(mainNavItems);

  const activeSubNav: SubNavConfig | null = useMemo(() => {
    const moduleId = matchModuleByPathname(pathname, modules);
    const activeModule = moduleId
      ? modules.find((m) => m.id === moduleId)
      : undefined;

    return activeModule?.subNav ?? null;
  }, [pathname, modules]);

  const inSubMode = activeSubNav !== null;
  const prevInSubModeRef = useRef(false);

  useEffect(() => {
    if (inSubMode && !prevInSubModeRef.current) {
      setCollapsed(true);
      setSubCollapsed(false);
    }
    prevInSubModeRef.current = inSubMode;
  }, [inSubMode]);

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
        <SubPanel config={activeSubNav} onCollapse={handleToggleSub} />
      ) : null}
      {showSubRail ? (
        <SubRail items={subRailItems} onExpand={handleToggleSub} />
      ) : null}
    </div>
  );
};

export default Sidebar;
