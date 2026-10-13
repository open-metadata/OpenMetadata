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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { OperationPermission } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import {
  App,
  ScheduleType,
} from '../../../../../../generated/entity/applications/app';
import {
  getApplicationByName,
  uninstallApp,
} from '../../../../../../rest/applicationAPI';
import { getDerivedPermissionFlags } from '../../../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../../../utils/PermissionsUtils';
import applicationsClassBase from '../../../../../Settings/Applications/AppDetails/ApplicationsClassBase';
import AppSchedule from '../../../../../Settings/Applications/AppSchedule/AppSchedule.component';
import AppDetail from './AppDetail';
import type { ApplicationsHeader } from './Applications.types';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../utils/i18next/LocalUtil', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  t: (key: string) => key,
}));

jest.mock('../../../../../../rest/applicationAPI', () => ({
  configureApp: jest.fn(),
  deployApp: jest.fn(),
  getApplicationByName: jest.fn(),
  patchApplication: jest.fn(),
  restoreApp: jest.fn(),
  triggerOnDemandApp: jest.fn(),
  uninstallApp: jest.fn(),
}));

let mockPlugins: { name: string; getAppDetails?: () => () => JSX.Element }[] =
  [];

jest.mock(
  '../../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({ plugins: mockPlugins }),
  })
);

const mockUseEntityPermissions = jest.fn();

jest.mock(
  '../../../../../../hooks/useEntityPermissions/useEntityPermissions',
  () => ({
    useEntityPermissions: (...args: unknown[]) =>
      mockUseEntityPermissions(...args),
  })
);

const setPermissions = (permissions: Partial<OperationPermission>) =>
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(
      { ...DEFAULT_ENTITY_PERMISSION, ...permissions },
      false
    ),
  });

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true }),
}));

jest.mock('../../../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: () => ({ getResourceLimit: jest.fn() }),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../../Settings/Applications/AppSchedule/AppSchedule.component',
  () => jest.fn(() => <div data-testid="app-schedule" />)
);
jest.mock(
  '../../../../../Settings/Applications/AppRunsHistory/AppRunsHistory.component',
  () => jest.fn(() => <div data-testid="app-runs-history" />)
);
jest.mock(
  '../../../../../Settings/Applications/AppLiveIndexing/AppLiveIndexing.component',
  () => jest.fn(() => <div data-testid="app-live-indexing" />)
);
jest.mock(
  '../../../../../Settings/Applications/McpApplicationConfiguration/McpApplicationConfiguration',
  () => jest.fn(() => <div data-testid="mcp-config" />)
);

const baseApp = {
  id: 'app-1',
  name: 'DataInsightsApplication',
  fullyQualifiedName: 'DataInsightsApplication',
  displayName: 'Data Insights',
  developer: 'Collate Inc.',
  developerUrl: 'https://www.getcollate.io',
  scheduleType: ScheduleType.ScheduledOrManual,
  allowConfiguration: true,
  appConfiguration: { batchSize: 10 },
  updatedAt: Date.now(),
} as unknown as App;

const onNavigate = jest.fn();
const onHeaderChange = jest.fn();

const renderDetail = async (app: Partial<App> = {}) => {
  (getApplicationByName as jest.Mock).mockResolvedValue({
    ...baseApp,
    ...app,
  });
  const result = render(
    <AppDetail
      fqn={app.fullyQualifiedName ?? baseApp.fullyQualifiedName ?? ''}
      onHeaderChange={onHeaderChange}
      onNavigate={onNavigate}
    />
  );
  await act(async () => undefined);

  return result;
};

const lastHeader = (): ApplicationsHeader =>
  onHeaderChange.mock.calls.at(-1)[0];

const tabNames = () => screen.getAllByRole('tab').map((tab) => tab.textContent);

describe('AppDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPermissions({
      EditAll: true,
      Delete: true,
      Trigger: true,
      Deploy: true,
    });
    jest
      .spyOn(applicationsClassBase, 'importSchema')
      .mockResolvedValue({ type: 'object' });
    jest
      .spyOn(applicationsClassBase, 'getModalAppConfigurationComponent')
      .mockReturnValue(() => <div data-testid="config-form" />);
    mockPlugins = [];
  });

  it('shows schedule, configuration and runs tabs with core-ui only', async () => {
    const { container } = await renderDetail();

    expect(tabNames()).toEqual([
      'label.schedule',
      'label.configuration',
      'label.recent-run-plural',
    ]);
    expect(screen.getByTestId('app-schedule')).toBeInTheDocument();
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });

  it('shows the not-found placeholder when the app does not exist', async () => {
    (getApplicationByName as jest.Mock).mockRejectedValue(new Error('404'));
    render(
      <AppDetail
        fqn="Missing"
        onHeaderChange={onHeaderChange}
        onNavigate={onNavigate}
      />
    );
    await act(async () => undefined);

    expect(screen.getByTestId('app-not-found')).toHaveTextContent('Missing');
  });

  it('adds the live indexing tab for search indexing only', async () => {
    await renderDetail({
      name: 'SearchIndexingApplication',
      fullyQualifiedName: 'SearchIndexingApplication',
    });

    expect(tabNames()).toContain('label.live-indexing');
  });

  it('drops schedule and runs tabs for apps without a schedule', async () => {
    await renderDetail({ scheduleType: ScheduleType.NoSchedule });

    expect(tabNames()).toEqual(['label.configuration']);
  });

  it('uses the MCP form for the MCP app', async () => {
    await renderDetail({
      name: 'McpApplication',
      fullyQualifiedName: 'McpApplication',
      scheduleType: ScheduleType.NoSchedule,
    });

    expect(screen.getByTestId('mcp-config')).toBeInTheDocument();
  });

  it('lets an installed app plugin replace the tabs, as on the legacy page', async () => {
    mockPlugins = [
      {
        name: 'DataInsightsApplication',
        getAppDetails: () => () => <div data-testid="plugin-details" />,
      },
    ];
    await renderDetail();

    expect(screen.getByTestId('plugin-details')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows installed, developer and website details in the header', async () => {
    await renderDetail();
    render(lastHeader().meta as ReactElement);

    expect(screen.getByTestId('app-meta')).toHaveTextContent('label.installed');
    expect(screen.getByTestId('app-meta')).toHaveTextContent(
      'label.developed-by-developer'
    );
    expect(screen.getByTestId('developer-website')).toHaveAttribute(
      'href',
      'https://www.getcollate.io'
    );
  });

  it('shows the hint toggle only on the configuration tab', async () => {
    await renderDetail();
    const { unmount } = render(lastHeader().actions as ReactElement);

    expect(screen.queryByTestId('show-hint-toggle')).not.toBeInTheDocument();

    unmount();
    fireEvent.click(screen.getByRole('tab', { name: 'label.configuration' }));
    render(lastHeader().actions as ReactElement);

    expect(screen.getByTestId('show-hint-toggle')).toBeInTheDocument();
  });

  it('offers Disable and Uninstall for an active app', async () => {
    await renderDetail();
    render(lastHeader().actions as ReactElement);

    fireEvent.click(screen.getByTestId('manage-button'));

    expect(
      screen.getByRole('menuitem', { name: 'label.disable' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'label.uninstall' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'label.restore' })
    ).not.toBeInTheDocument();
  });

  it('offers Restore for a disabled app and hides Uninstall for system apps', async () => {
    await renderDetail({ deleted: true, system: true });
    render(lastHeader().titleSuffix as ReactElement);

    expect(screen.getByTestId('runtime-disabled-badge')).toBeInTheDocument();
    expect(tabNames()).not.toContain('label.recent-run-plural');

    render(lastHeader().actions as ReactElement);
    fireEvent.click(screen.getByTestId('manage-button'));

    expect(
      screen.getByRole('menuitem', { name: 'label.restore' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'label.uninstall' })
    ).not.toBeInTheDocument();
  });

  it('uninstalls after confirmation and returns to the list', async () => {
    (uninstallApp as jest.Mock).mockResolvedValue({});
    await renderDetail();
    render(lastHeader().actions as ReactElement);

    fireEvent.click(screen.getByTestId('manage-button'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'label.uninstall' }));

    expect(screen.getByTestId('app-action-confirm')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('app-action-confirm-confirm'));
    });

    expect(uninstallApp).toHaveBeenCalledWith('DataInsightsApplication', true);
    expect(onNavigate).toHaveBeenCalledWith({ type: 'list' });
  });

  it('hides the three-dot menu without delete permission', async () => {
    setPermissions({ EditAll: true });
    await renderDetail();
    render(lastHeader().actions as ReactElement);

    expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument();
  });

  it('passes schedule permissions and makes config read-only without edit access', async () => {
    setPermissions({ ViewAll: true });
    const configForm = jest.fn(() => <div data-testid="config-form" />);
    jest
      .spyOn(applicationsClassBase, 'getModalAppConfigurationComponent')
      .mockReturnValue(configForm);
    await renderDetail();

    expect(AppSchedule).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canEdit: false,
        canTrigger: false,
        canDeploy: false,
      }),
      expect.anything()
    );

    fireEvent.click(screen.getByRole('tab', { name: 'label.configuration' }));

    expect(configForm).toHaveBeenLastCalledWith(
      expect.objectContaining({ isReadOnly: true }),
      expect.anything()
    );
  });
});
