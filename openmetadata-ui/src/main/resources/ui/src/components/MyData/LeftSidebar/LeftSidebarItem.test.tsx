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
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import {
  LOGOUT_ITEM,
  SETTING_ITEM,
} from '../../../constants/LeftSidebar.constants';
import LeftSidebarItem from './LeftSidebarItem.component';

jest.mock('../../Auth/AuthProviders/AuthProvider', () => ({
  useAuthProvider: jest.fn().mockImplementation(() => ({
    onLogoutHandler: jest.fn(),
  })),
}));

const mockUseCurrentUserPreferences = jest.fn();

jest.mock(
  '../../../hooks/currentUserStore/useCurrentUserStore',
  () => ({
    useCurrentUserPreferences: () => mockUseCurrentUserPreferences(),
  })
);

const BETA_ITEM = {
  key: '/ontology-explorer',
  title: 'label.ontology-explorer',
  redirect_url: '/ontology-explorer',
  icon: jest.fn(),
  dataTestId: 'app-bar-item-ontology-explorer',
  showBetaOnCollapse: true,
};

const IBETA_ITEM = {
  key: '/some-feature',
  title: 'label.some-feature',
  redirect_url: '/some-feature',
  icon: jest.fn(),
  dataTestId: 'app-bar-item-some-feature',
  isBeta: true,
};

describe('LeftSidebar Items', () => {
  beforeEach(() => {
    mockUseCurrentUserPreferences.mockReturnValue({
      preferences: { isSidebarCollapsed: false },
      setPreference: jest.fn(),
    });
  });

  it('should renders sidebar items data', () => {
    render(
      <BrowserRouter>
        <LeftSidebarItem data={SETTING_ITEM} />
      </BrowserRouter>
    );

    expect(screen.getByTestId('app-bar-item-settings')).toBeInTheDocument();

    expect(screen.getByText('label.setting-plural')).toBeInTheDocument();
  });

  it('should renders sidebar items with redirect url', () => {
    render(
      <BrowserRouter>
        <LeftSidebarItem data={SETTING_ITEM} />
      </BrowserRouter>
    );

    expect(screen.getByTestId('app-bar-item-settings')).toBeInTheDocument();

    expect(screen.getByText('label.setting-plural')).toBeInTheDocument();

    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('should renders sidebar items without redirect url', () => {
    render(
      <BrowserRouter>
        <LeftSidebarItem data={LOGOUT_ITEM} />
      </BrowserRouter>
    );

    expect(screen.getByTestId('app-bar-item-logout')).toBeInTheDocument();

    expect(screen.getByText('label.logout')).toBeInTheDocument();

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  describe('beta tag visibility', () => {
    it('should always show beta badge for isBeta items regardless of sidebar state', () => {
      mockUseCurrentUserPreferences.mockReturnValue({
        preferences: { isSidebarCollapsed: false },
        setPreference: jest.fn(),
      });

      render(
        <BrowserRouter>
          <LeftSidebarItem data={IBETA_ITEM} />
        </BrowserRouter>
      );

      expect(screen.getByText('label.beta')).toBeInTheDocument();
    });

    it('should show beta badge for isBeta items even when sidebar is collapsed', () => {
      mockUseCurrentUserPreferences.mockReturnValue({
        preferences: { isSidebarCollapsed: true },
        setPreference: jest.fn(),
      });

      render(
        <BrowserRouter>
          <LeftSidebarItem data={IBETA_ITEM} />
        </BrowserRouter>
      );

      expect(screen.getByText('label.beta')).toBeInTheDocument();
    });

    it('should not show beta badge for showBetaOnCollapse items when sidebar is expanded', () => {
      mockUseCurrentUserPreferences.mockReturnValue({
        preferences: { isSidebarCollapsed: false },
        setPreference: jest.fn(),
      });

      render(
        <BrowserRouter>
          <LeftSidebarItem data={BETA_ITEM} />
        </BrowserRouter>
      );

      expect(screen.queryByText('label.beta')).not.toBeInTheDocument();
    });

    it('should show beta badge for showBetaOnCollapse items when sidebar is collapsed', () => {
      mockUseCurrentUserPreferences.mockReturnValue({
        preferences: { isSidebarCollapsed: true },
        setPreference: jest.fn(),
      });

      render(
        <BrowserRouter>
          <LeftSidebarItem data={BETA_ITEM} />
        </BrowserRouter>
      );

      expect(screen.getByText('label.beta')).toBeInTheDocument();
    });
  });
});
