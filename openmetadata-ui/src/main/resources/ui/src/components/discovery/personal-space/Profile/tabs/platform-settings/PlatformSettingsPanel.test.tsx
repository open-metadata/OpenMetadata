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
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../../../../generated/settings/settings';
import PlatformSettingsPanel from './PlatformSettingsPanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockSetHash = jest.fn();
let mockSubPath = '';
let mockProvider: AuthProvider | undefined = AuthProvider.Basic;

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: { tab: 'platform-settings', subPath: mockSubPath, params: {} },
    setHash: mockSetHash,
  }),
}));

jest.mock('../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: (selector: (state: unknown) => unknown) =>
    selector({ authConfig: { provider: mockProvider } }),
}));

// The pages own their data fetching; the panel test only checks which one is
// routed to and what the header shows, so each page is a stand-in.
jest.mock('./EmailSettings', () => () => <div data-testid="email-view" />);
jest.mock('./EmailSettingsForm', () => () => <div data-testid="email-form" />);
jest.mock('./HealthCheckSettings', () => () => (
  <div data-testid="health-view" />
));
jest.mock('./LineageSettings', () => () => <div data-testid="lineage-view" />);
jest.mock('./LineageSettingsForm', () => () => (
  <div data-testid="lineage-form" />
));
jest.mock('./LoginSettings', () => () => <div data-testid="login-view" />);
jest.mock('./LoginSettingsForm', () => () => <div data-testid="login-form" />);
jest.mock('./BrandUrlSettings', () => () => (
  <div data-testid="brand-url-view" />
));
jest.mock('./BrandUrlSettingsForm', () => () => (
  <div data-testid="brand-url-form" />
));
jest.mock('./AppModeSettings', () => () => <div data-testid="app-mode-view" />);
jest.mock('./ThemeSettings', () => () => <div data-testid="theme-view" />);
jest.mock('./ThemeSettingsForm', () => () => <div data-testid="theme-form" />);
jest.mock('./ProfilerSettings', () => () => (
  <div data-testid="profiler-view" />
));
jest.mock('./ProfilerSettingsForm', () => () => (
  <div data-testid="profiler-form" />
));
jest.mock('./DataAssetRulesSettings', () => () => (
  <div data-testid="data-asset-rules-view" />
));
jest.mock('./LearningResourcesSettings', () => () => (
  <div data-testid="learning-resources-view" />
));
const mockFormMounts = jest.fn();

jest.mock('./LearningResourceSettingsForm', () => {
  const { useState } = jest.requireActual('react');

  return ({ itemId }: { itemId?: string }) => {
    // A lazy initializer runs once per mount, never on re-render.
    useState(() => mockFormMounts(itemId));

    return (
      <div data-item-id={itemId ?? ''} data-testid="learning-resource-form" />
    );
  };
});
jest.mock('./DataQualitySettings', () => () => (
  <div data-testid="data-quality-view" />
));
jest.mock('./DimensionSettingsForm', () =>
  jest.fn(({ itemId }: { itemId?: string }) => (
    <div data-item-id={itemId ?? ''} data-testid="dimension-form" />
  ))
);
jest.mock('./search/SearchSettingsView', () => () => (
  <div data-testid="search-view" />
));
jest.mock(
  './search/EntitySearchSettings',
  () =>
    ({ itemId }: { itemId: string }) =>
      <div data-testid="entity-search-view">{itemId}</div>
);
jest.mock('./AppModeSettingsForm', () => () => (
  <div data-testid="app-mode-form" />
));

const onHeaderChange = jest.fn();

const renderPanel = () =>
  render(
    <MemoryRouter>
      <PlatformSettingsPanel onHeaderChange={onHeaderChange} />
    </MemoryRouter>
  );

const lastHeader = () =>
  onHeaderChange.mock.calls[onHeaderChange.mock.calls.length - 1][0];

describe('PlatformSettingsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubPath = '';
    mockProvider = AuthProvider.Basic;
  });

  it('lists every legacy preferences page on the landing', () => {
    renderPanel();

    [
      'theme',
      'email',
      'login-configuration',
      'profiler-configuration',
      'data-quality',
      'health-check',
      'lineage',
      'brand-url',
      'data-asset-rules',
      'learning-resources',
      'search',
      'app-mode',
    ].forEach((id) =>
      expect(
        screen.getByTestId(`platform-settings-card-${id}`)
      ).toBeInTheDocument()
    );

    expect(lastHeader().title).toBe('label.platform-setting-plural');
  });

  it('marks Data Asset Rules as beta, as the classic menu does', () => {
    renderPanel();

    expect(
      screen.getByTestId('platform-settings-card-data-asset-rules')
    ).toHaveTextContent('label.beta');
    expect(
      screen.getByTestId('platform-settings-card-email')
    ).not.toHaveTextContent('label.beta');
  });

  it('hides login configuration for SSO providers', () => {
    mockProvider = AuthProvider.Google;
    renderPanel();

    expect(
      screen.queryByTestId('platform-settings-card-login-configuration')
    ).not.toBeInTheDocument();
  });

  it('navigates to a page from its landing card', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('platform-settings-card-email'));

    expect(mockSetHash).toHaveBeenCalledWith('platform-settings', 'email');
  });

  it.each(['Enter', ' '])(
    'opens a landing card from the keyboard with "%s"',
    (key) => {
      renderPanel();

      fireEvent.keyDown(screen.getByTestId('platform-settings-card-lineage'), {
        key,
      });

      expect(mockSetHash).toHaveBeenCalledWith('platform-settings', 'lineage');
    }
  );

  it('renders the read-only view with a page breadcrumb', () => {
    mockSubPath = 'email';
    renderPanel();

    expect(screen.getByTestId('email-view')).toBeInTheDocument();
    expect(lastHeader().title).toBe('label.email');
    expect(lastHeader().breadcrumbs.map((b: { id: string }) => b.id)).toEqual([
      'settings',
      'platform-settings',
      'email',
    ]);
  });

  it("renders the search settings, and one entity's settings as a sub-page", () => {
    mockSubPath = 'search';
    const { unmount } = renderPanel();

    expect(screen.getByTestId('search-view')).toBeInTheDocument();

    unmount();
    mockSubPath = 'search/tables';
    renderPanel();

    expect(screen.getByTestId('entity-search-view')).toHaveTextContent(
      'tables'
    );
    expect(lastHeader().title).toBe('Table');
    expect(lastHeader().breadcrumbs.map((b: { id: string }) => b.id)).toEqual([
      'settings',
      'platform-settings',
      'search',
      'item',
    ]);

    lastHeader().onBreadcrumbAction('search');

    expect(mockSetHash).toHaveBeenCalledWith('platform-settings', 'search');
  });

  it('renders the edit form with the show-hint toggle in the header', () => {
    mockSubPath = 'email/edit';
    renderPanel();

    expect(screen.getByTestId('email-form')).toBeInTheDocument();
    expect(lastHeader().breadcrumbs).toHaveLength(4);
    expect(lastHeader().title).toBe('label.edit-entity');

    render(lastHeader().actions);

    expect(screen.getByTestId('show-hint-toggle')).toBeInTheDocument();
  });

  it.each([
    ['lineage', 'lineage-view'],
    ['lineage/edit', 'lineage-form'],
    ['app-mode', 'app-mode-view'],
    ['app-mode/edit', 'app-mode-form'],
    ['theme', 'theme-view'],
    ['theme/edit', 'theme-form'],
    ['profiler-configuration', 'profiler-view'],
    ['profiler-configuration/edit', 'profiler-form'],
    ['data-quality', 'data-quality-view'],
    ['data-asset-rules', 'data-asset-rules-view'],
    ['learning-resources', 'learning-resources-view'],
    ['learning-resources/edit/res-1', 'learning-resource-form'],
  ])('routes "%s" to its view or edit form', (subPath, testId) => {
    mockSubPath = subPath;
    renderPanel();

    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('remounts the page when the route moves to another item, so it reloads', () => {
    mockSubPath = 'learning-resources/edit';
    const { rerender } = renderPanel();

    mockSubPath = 'learning-resources/edit/res-1';
    rerender(
      <MemoryRouter>
        <PlatformSettingsPanel onHeaderChange={onHeaderChange} />
      </MemoryRouter>
    );

    expect(mockFormMounts.mock.calls).toEqual([[undefined], ['res-1']]);
  });

  it('has no add/edit route for data asset rules', () => {
    mockSubPath = 'data-asset-rules/edit';
    renderPanel();

    expect(screen.getByTestId('data-asset-rules-view')).toBeInTheDocument();
  });

  it.each([
    ['data-quality/edit', '', 'label.add-entity'],
    ['data-quality/edit/freshness', 'freshness', 'label.edit-entity'],
  ])(
    'routes "%s" to the dimension form with its own title',
    (subPath, itemId, title) => {
      mockSubPath = subPath;
      renderPanel();

      expect(screen.getByTestId('dimension-form')).toHaveAttribute(
        'data-item-id',
        itemId
      );
      expect(lastHeader().title).toBe(title);
    }
  );

  it('omits the show-hint toggle on forms without field docs', () => {
    mockSubPath = 'app-mode/edit';
    renderPanel();

    expect(lastHeader().actions).toBeUndefined();
  });

  it('breadcrumb actions return to the landing and to the page view', () => {
    mockSubPath = 'brand-url/edit';
    renderPanel();

    lastHeader().onBreadcrumbAction('brand-url');

    expect(mockSetHash).toHaveBeenLastCalledWith(
      'platform-settings',
      'brand-url'
    );

    lastHeader().onBreadcrumbAction('platform-settings');

    expect(mockSetHash).toHaveBeenLastCalledWith(
      'platform-settings',
      undefined
    );
  });
});
