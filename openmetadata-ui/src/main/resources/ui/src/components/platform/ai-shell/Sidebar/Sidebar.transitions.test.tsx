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

import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppModule } from '../AppModule.types';
import { useActiveModuleStore } from '../state/useActiveModule';
import Sidebar from './Sidebar';
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from './useSidebarState';

const mockModules = [
  { id: 'home' },
  { id: 'observability', subNav: { key: 'observability', sections: [] } },
  { id: 'governance', subNav: { key: 'governance', sections: [] } },
] as unknown as AppModule[];

jest.mock('../sharedAppModules', () => ({
  useAllAppModules: () => mockModules,
}));

jest.mock('./navConfig', () => ({
  buildMainNavItems: () => [],
  resolveActiveSubNavKey: () => undefined,
}));

jest.mock('./useCustomizedMainNav', () => ({
  useCustomizedMainNav: () => ({ nodes: [] }),
}));

jest.mock('./useContextCenterBadges', () => ({
  useContextCenterBadges: () => undefined,
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));

// Stub the four panels so this test drives the collapse/expand coordination in
// Sidebar, not each panel's internals. Each exposes its toggle callback.
jest.mock('./MainPanel', () => ({
  __esModule: true,
  default: ({ onCollapse }: { onCollapse: () => void }) => (
    <div data-testid="ask-main-panel">
      <button
        aria-label="collapse main"
        data-testid="main-collapse"
        onClick={onCollapse}
      />
    </div>
  ),
}));

jest.mock('./Rail', () => ({
  __esModule: true,
  default: ({ onToggle }: { onToggle: () => void }) => (
    <div data-testid="ask-rail">
      <button
        aria-label="expand main"
        data-testid="rail-expand"
        onClick={onToggle}
      />
    </div>
  ),
}));

jest.mock('./SubPanel', () => ({
  __esModule: true,
  default: ({ onCollapse }: { onCollapse: () => void }) => (
    <div data-testid="ask-sub-panel">
      <button
        aria-label="collapse sub"
        data-testid="sub-collapse"
        onClick={onCollapse}
      />
    </div>
  ),
}));

jest.mock('./SubRail', () => ({
  __esModule: true,
  default: ({ onExpand }: { onExpand: () => void }) => (
    <div data-testid="ask-sub-rail">
      <button
        aria-label="expand sub"
        data-testid="sub-expand"
        onClick={onExpand}
      />
    </div>
  ),
}));

const setModule = (id: string | null) =>
  act(() => useActiveModuleStore.setState({ activeModule: id }));

const renderSidebar = () =>
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );

const railed = () => screen.queryByTestId('ask-rail') !== null;
const subPanelOpen = () => screen.queryByTestId('ask-sub-panel') !== null;
const subRailShown = () => screen.queryByTestId('ask-sub-rail') !== null;

describe('Sidebar dual-nav transitions', () => {
  beforeEach(() => {
    localStorage.clear();
    useActiveModuleStore.setState({ activeModule: null });
  });

  afterEach(() => {
    act(() => {
      useActiveModuleStore.setState({ activeModule: null });
    });
  });

  it('enters a sub-context railed, with the submenu expanded, by default', () => {
    setModule('observability');
    const { container } = renderSidebar();

    expect(railed()).toBe(true);
    expect(subPanelOpen()).toBe(true);
    expect(subRailShown()).toBe(false);
    expect(container.firstChild).toHaveClass('ask-sidebar--collapsed');
    expect(container.firstChild).toHaveClass('ask-sidebar--sub');
    expect(container.firstChild).not.toHaveClass('ask-sidebar--sub-collapsed');
  });

  it('expanding the main nav inside a sub-context is transient (rails the submenu, persists nothing)', () => {
    setModule('observability');
    renderSidebar();

    fireEvent.click(screen.getByTestId('rail-expand'));

    expect(railed()).toBe(false);
    expect(screen.getByTestId('ask-main-panel')).toBeInTheDocument();
    expect(subRailShown()).toBe(true);
    expect(subPanelOpen()).toBe(false);
    // Not persisted: the preference must not leak out of the sub-context.
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBeNull();
  });

  it('switching to another sub-context re-rails the main nav and re-opens the submenu', () => {
    setModule('observability');
    renderSidebar();

    fireEvent.click(screen.getByTestId('rail-expand'));

    expect(railed()).toBe(false);

    setModule('governance');

    expect(railed()).toBe(true);
    expect(subPanelOpen()).toBe(true);
    expect(subRailShown()).toBe(false);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBeNull();
  });

  it('expanding the submenu rails the main nav so only one full panel is open', () => {
    setModule('observability');
    renderSidebar();

    // Expand main → main full, submenu on its rail.
    fireEvent.click(screen.getByTestId('rail-expand'));

    expect(railed()).toBe(false);
    expect(subRailShown()).toBe(true);

    // Expand the submenu → the main nav must rail again.
    fireEvent.click(screen.getByTestId('sub-expand'));

    expect(railed()).toBe(true);
    expect(subPanelOpen()).toBe(true);
    expect(subRailShown()).toBe(false);
  });

  it('persists a top-level collapse and restores it across a sub-context round-trip', () => {
    setModule(null);
    renderSidebar();

    expect(railed()).toBe(false);

    fireEvent.click(screen.getByTestId('main-collapse'));

    expect(railed()).toBe(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true');

    setModule('observability');

    expect(railed()).toBe(true);

    setModule(null);

    expect(railed()).toBe(true);
  });
});
