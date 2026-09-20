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
import { observabilityModule } from '../../../observability/ObservabilityModule/observability.module';
import { AppModule } from '../AppModule.types';
import { useActiveModuleStore } from '../state/useActiveModule';
import Sidebar from './Sidebar';
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from './useSidebarState';

// A second sub-context: the same real SubNavConfig under a different module id,
// so switching modules exercises the real SubPanel/SubRail again without pulling
// another module's assets into the test.
const SECOND_MODULE: AppModule = {
  ...observabilityModule,
  id: 'second-context',
  subNav: observabilityModule.subNav
    ? { ...observabilityModule.subNav, key: 'second-context' }
    : undefined,
};

const OBS_ID = observabilityModule.id;
const SECOND_ID = SECOND_MODULE.id;

jest.mock('../sharedAppModules', () => ({
  useAllAppModules: () => [observabilityModule, SECOND_MODULE],
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

// Only the two heavy main-nav panels are stubbed: the real Rail/MainPanel pull
// the app-mode extension registry, domain-scope store and user-profile card and
// have their own tests. SubPanel and SubRail render for real, so the submenu
// affordances this suite drives (collapse/expand) are the real ones.
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

const setModule = (id: string | null) =>
  act(() => useActiveModuleStore.setState({ activeModule: id }));

const renderSidebar = () =>
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );

const hasClass = (modifier: string) =>
  (screen.getByTestId('ask-sidebar') as HTMLElement).classList.contains(
    modifier
  );
const present = (testId: string) => screen.queryByTestId(testId) !== null;

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
    setModule(OBS_ID);
    renderSidebar();

    expect(hasClass('ask-sidebar--sub')).toBe(true);
    expect(hasClass('ask-sidebar--collapsed')).toBe(true);
    expect(hasClass('ask-sidebar--sub-collapsed')).toBe(false);
    expect(present('ask-rail')).toBe(true);
    expect(present('ask-sub-panel')).toBe(true);
    expect(present('ask-sub-rail')).toBe(false);
  });

  it('collapsing the submenu from its panel keeps the main nav railed', () => {
    setModule(OBS_ID);
    renderSidebar();

    fireEvent.click(screen.getByTestId('ask-sub-panel-collapse-btn'));

    expect(hasClass('ask-sidebar--collapsed')).toBe(true);
    expect(hasClass('ask-sidebar--sub-collapsed')).toBe(true);
    expect(present('ask-rail')).toBe(true);
    expect(present('ask-sub-rail')).toBe(true);
    expect(present('ask-sub-panel')).toBe(false);
  });

  it('expanding the main nav inside a sub-context is transient (rails the submenu, persists nothing)', () => {
    setModule(OBS_ID);
    renderSidebar();

    fireEvent.click(screen.getByTestId('rail-expand'));

    expect(hasClass('ask-sidebar--collapsed')).toBe(false);
    expect(hasClass('ask-sidebar--sub-collapsed')).toBe(true);
    expect(present('ask-rail')).toBe(false);
    expect(present('ask-main-panel')).toBe(true);
    expect(present('ask-sub-rail')).toBe(true);
    expect(present('ask-sub-panel')).toBe(false);
    // Not persisted: the preference must not leak out of the sub-context.
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBeNull();
  });

  it('switching to another sub-context re-rails the main nav and re-opens the submenu', () => {
    setModule(OBS_ID);
    renderSidebar();

    fireEvent.click(screen.getByTestId('rail-expand'));

    expect(hasClass('ask-sidebar--collapsed')).toBe(false);

    setModule(SECOND_ID);

    expect(hasClass('ask-sidebar--collapsed')).toBe(true);
    expect(hasClass('ask-sidebar--sub-collapsed')).toBe(false);
    expect(present('ask-rail')).toBe(true);
    expect(present('ask-sub-panel')).toBe(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBeNull();
  });

  it('expanding the submenu rails the main nav so only one full panel is open', () => {
    setModule(OBS_ID);
    renderSidebar();

    // Expand main → main full, submenu on its rail.
    fireEvent.click(screen.getByTestId('rail-expand'));

    expect(hasClass('ask-sidebar--collapsed')).toBe(false);
    expect(present('ask-sub-rail')).toBe(true);

    // Expand the submenu from its rail → the main nav must rail again.
    fireEvent.click(screen.getByTestId('ask-sub-rail-expand-btn'));

    expect(hasClass('ask-sidebar--collapsed')).toBe(true);
    expect(hasClass('ask-sidebar--sub-collapsed')).toBe(false);
    expect(present('ask-sub-panel')).toBe(true);
    expect(present('ask-sub-rail')).toBe(false);
  });

  it('persists a top-level collapse and restores it across a sub-context round-trip', () => {
    setModule(null);
    renderSidebar();

    expect(hasClass('ask-sidebar--sub')).toBe(false);
    expect(hasClass('ask-sidebar--collapsed')).toBe(false);
    expect(present('ask-rail')).toBe(false);

    fireEvent.click(screen.getByTestId('main-collapse'));

    expect(hasClass('ask-sidebar--collapsed')).toBe(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)).toBe('true');

    setModule(OBS_ID);

    expect(hasClass('ask-sidebar--collapsed')).toBe(true);

    setModule(null);

    expect(hasClass('ask-sidebar--collapsed')).toBe(true);
  });
});
