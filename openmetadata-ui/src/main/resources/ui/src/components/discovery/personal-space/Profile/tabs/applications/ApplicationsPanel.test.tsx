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

import { render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import type { ApplicationsViewProps } from './Applications.types';
import ApplicationsPanel from './ApplicationsPanel';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

let mockIsAdmin = true;

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdmin }),
}));

const mockSetHash = jest.fn();
let mockSubPath = '';

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: { tab: 'applications', subPath: mockSubPath, params: {} },
    setHash: mockSetHash,
  }),
}));

// Each stub view reports a crumb so the panel's breadcrumb trail is exercised.
// A function declaration so the hoisted jest.mock factories can call it.
function mockStubView(testId: string, crumb?: string) {
  return function StubView({ onHeaderChange }: ApplicationsViewProps) {
    useEffect(() => {
      onHeaderChange({ crumb });
    }, [onHeaderChange]);

    return <div data-testid={testId} />;
  };
}

jest.mock('./ApplicationsList', () => mockStubView('applications-list'));
jest.mock('./MarketplaceList', () => mockStubView('marketplace-list'));
jest.mock('./MarketplaceAppDetail', () =>
  mockStubView('marketplace-app-detail', 'RDF')
);
jest.mock('./AppInstall', () => mockStubView('app-install', 'RDF'));
jest.mock('./AppDetail', () => mockStubView('app-detail', 'Search Indexing'));

const onHeaderChange = jest.fn();

const lastCrumbs = () =>
  onHeaderChange.mock.calls
    .at(-1)[0]
    .breadcrumbs.map((crumb: { label: string }) => crumb.label);

const renderAt = (subPath: string) => {
  mockSubPath = subPath;

  return render(<ApplicationsPanel onHeaderChange={onHeaderChange} />);
};

describe('ApplicationsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAdmin = true;
  });

  it('shows the installed list by default', () => {
    renderAt('');

    expect(screen.getByTestId('applications-list')).toBeInTheDocument();
    expect(lastCrumbs()).toEqual([
      'label.setting-plural',
      'label.application-plural',
    ]);
    expect(onHeaderChange.mock.calls.at(-1)[0].title).toBe(
      'label.application-plural'
    );
  });

  it('routes to the marketplace list', () => {
    renderAt('marketplace');

    expect(screen.getByTestId('marketplace-list')).toBeInTheDocument();
    expect(lastCrumbs()).toEqual([
      'label.setting-plural',
      'label.application-plural',
      'label.market-place',
    ]);
  });

  it('routes to a marketplace app detail', () => {
    renderAt('marketplace/RdfIndexApp');

    expect(screen.getByTestId('marketplace-app-detail')).toBeInTheDocument();
    expect(lastCrumbs()).toEqual([
      'label.setting-plural',
      'label.application-plural',
      'label.market-place',
      'RDF',
    ]);
  });

  it('routes to the install flow', () => {
    renderAt('marketplace/RdfIndexApp/install');

    expect(screen.getByTestId('app-install')).toBeInTheDocument();
    expect(lastCrumbs()).toEqual([
      'label.setting-plural',
      'label.application-plural',
      'label.market-place',
      'RDF',
      'label.install',
    ]);
  });

  it('routes to an installed app and navigates back via breadcrumbs', () => {
    renderAt('SearchIndexingApplication');

    expect(screen.getByTestId('app-detail')).toBeInTheDocument();
    expect(lastCrumbs()).toEqual([
      'label.setting-plural',
      'label.application-plural',
      'Search Indexing',
    ]);

    onHeaderChange.mock.calls.at(-1)[0].onBreadcrumbAction('applications');

    expect(mockSetHash).toHaveBeenCalledWith('applications', undefined);
  });

  it('renders a footer slot pinned below the scrolling content', () => {
    renderAt('');

    const footer = screen.getByTestId('applications-footer');

    expect(screen.getByTestId('applications-panel').lastChild).toBe(footer);
    expect(footer).toBeEmptyDOMElement();
  });

  it('blocks the marketplace and install flow for non-admins', () => {
    mockIsAdmin = false;
    const { unmount } = renderAt('marketplace');

    expect(screen.getByTestId('app-no-permission')).toBeInTheDocument();
    expect(screen.queryByTestId('marketplace-list')).not.toBeInTheDocument();

    unmount();
    renderAt('marketplace/RdfIndexApp/install');

    expect(screen.queryByTestId('app-install')).not.toBeInTheDocument();
  });

  it('still shows installed apps to non-admins', () => {
    mockIsAdmin = false;
    renderAt('SearchIndexingApplication');

    expect(screen.getByTestId('app-detail')).toBeInTheDocument();
  });
});
