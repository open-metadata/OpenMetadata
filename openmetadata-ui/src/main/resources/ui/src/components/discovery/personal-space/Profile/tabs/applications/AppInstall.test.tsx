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
import { ScheduleType } from '../../../../../../generated/entity/applications/app';
import { ScheduleTimeline } from '../../../../../../generated/entity/applications/createAppRequest';
import { installApplication } from '../../../../../../rest/applicationAPI';
import { getMarketPlaceApplicationByFqn } from '../../../../../../rest/applicationMarketPlaceAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import applicationsClassBase from '../../../../../Settings/Applications/AppDetails/ApplicationsClassBase';
import type { AppConfigFormProps } from './AppConfigForm';
import AppInstall from './AppInstall';
import type { ApplicationsHeader } from './Applications.types';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../utils/i18next/LocalUtil', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
  t: (key: string) => key,
  Transi18next: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}));

jest.mock('../../../../../../rest/applicationAPI', () => ({
  installApplication: jest.fn(),
}));

jest.mock('../../../../../../rest/applicationMarketPlaceAPI', () => ({
  getMarketPlaceApplicationByFqn: jest.fn(),
}));

jest.mock('../../../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: () => ({ config: undefined, getResourceLimit: jest.fn() }),
}));

jest.mock('../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { name: 'admin', displayName: 'Admin' },
  }),
}));

jest.mock('../../../../../common/BrandImage/BrandImage', () =>
  jest.fn(() => <span data-testid="brand-monogram" />)
);

jest.mock('../../../../../common/PopOverCard/UserPopOverCard', () =>
  jest.fn(() => <span data-testid="user-avatar" />)
);

jest.mock(
  '../../../../../Settings/Services/AddIngestion/Steps/ScheduleInterval',
  () =>
    jest.fn(({ onChange }: { onChange: (value: string) => void }) => (
      <button data-testid="pick-schedule" onClick={() => onChange('0 0 * * *')}>
        ScheduleInterval
      </button>
    ))
);

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const ConfigStub = ({ onSave, onCancel, submitLabel }: AppConfigFormProps) => (
  <div data-testid="config-form">
    <button onClick={onCancel}>config-back</button>
    <button onClick={() => onSave({ formData: { batchSize: 5 } })}>
      {submitLabel}
    </button>
  </div>
);

const marketplaceApp = {
  id: '1',
  name: 'SearchIndexingApplication',
  fullyQualifiedName: 'SearchIndexingApplication',
  displayName: 'Search Indexing',
  developer: 'Collate Inc.',
  allowConfiguration: true,
  scheduleType: ScheduleType.ScheduledOrManual,
  appConfiguration: { batchSize: 100 },
};

const onNavigate = jest.fn();
const onHeaderChange = jest.fn();

const renderInstall = async () => {
  const result = render(
    <AppInstall
      fqn="SearchIndexingApplication"
      onHeaderChange={onHeaderChange}
      onNavigate={onNavigate}
    />
  );
  await act(async () => undefined);

  return result;
};

const lastHeader = (): ApplicationsHeader =>
  onHeaderChange.mock.calls.at(-1)[0];

describe('AppInstall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMarketPlaceApplicationByFqn as jest.Mock).mockResolvedValue(
      marketplaceApp
    );
    (installApplication as jest.Mock).mockResolvedValue({});
    jest
      .spyOn(applicationsClassBase, 'importSchema')
      .mockResolvedValue({ type: 'object' });
    jest
      .spyOn(applicationsClassBase, 'getModalAppConfigurationComponent')
      .mockReturnValue(ConfigStub);
    applicationsClassBase.appPluginRegistry = {};
  });

  it('starts on the authorize step with core-ui only', async () => {
    const { container } = await renderInstall();

    expect(screen.getByTestId('authorize-card')).toBeInTheDocument();
    expect(screen.getByText('label.authorize-app')).toBeInTheDocument();
    expect(screen.getByText('label.detail-plural')).toBeInTheDocument();
    expect(screen.getByText('label.configure')).toBeInTheDocument();
    expect(screen.getByText('label.schedule')).toBeInTheDocument();
    expect(screen.getByTestId('next-button')).toHaveTextContent('label.next');
    expect(lastHeader().actions).toBeUndefined();
    expect(container.querySelector('[class*="ant-"]')).toBeNull();
  });

  it('goes back to the marketplace detail on cancel', async () => {
    await renderInstall();

    fireEvent.click(screen.getByTestId('back-button'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'marketplace-detail',
      fqn: 'SearchIndexingApplication',
    });
  });

  it('walks configure and schedule, then installs with both', async () => {
    await renderInstall();

    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('config-form')).toBeInTheDocument();
    expect(lastHeader().actions).toBeDefined();

    fireEvent.click(screen.getByText('label.next'));
    fireEvent.click(screen.getByTestId('pick-schedule'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('next-button'));
    });

    expect(installApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'SearchIndexingApplication',
        appConfiguration: { batchSize: 5 },
        appSchedule: {
          scheduleTimeline: ScheduleTimeline.Custom,
          cronExpression: '0 0 * * *',
        },
      })
    );
    expect(onNavigate).toHaveBeenCalledWith({ type: 'list' });
  });

  it('installs straight from the details step when nothing else is needed', async () => {
    (getMarketPlaceApplicationByFqn as jest.Mock).mockResolvedValue({
      ...marketplaceApp,
      allowConfiguration: false,
      scheduleType: ScheduleType.NoSchedule,
    });
    await renderInstall();

    const install = screen.getByTestId('next-button');

    expect(install).toHaveTextContent('label.install');

    await act(async () => {
      fireEvent.click(install);
    });

    expect(installApplication).toHaveBeenCalledWith(
      expect.not.objectContaining({ appSchedule: expect.anything() })
    );
  });

  it('lets a registered plugin replace the steps, as on the legacy page', async () => {
    applicationsClassBase.appPluginRegistry = {
      SearchIndexingApplication: class {
        getAppInstallComponent() {
          return () => <div data-testid="plugin-install" />;
        }
      } as unknown as (typeof applicationsClassBase.appPluginRegistry)[string],
    };
    await renderInstall();

    expect(screen.getByTestId('plugin-install')).toBeInTheDocument();
    expect(screen.queryByTestId('authorize-card')).not.toBeInTheDocument();
  });

  it('skips Configure when the schema cannot be loaded, so the wizard never dead-ends', async () => {
    jest
      .spyOn(applicationsClassBase, 'importSchema')
      .mockRejectedValue(new Error('no schema'));
    await renderInstall();

    expect(showErrorToast).toHaveBeenCalledWith(
      'server.no-application-schema-found'
    );
    expect(screen.queryByText('label.configure')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('next-button'));

    expect(screen.getByTestId('pick-schedule')).toBeInTheDocument();
    expect(screen.queryByTestId('config-form')).not.toBeInTheDocument();
  });

  it('reports a marketplace fetch failure with its own error', async () => {
    const error = new Error('404');
    (getMarketPlaceApplicationByFqn as jest.Mock).mockRejectedValue(error);
    await renderInstall();

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(showErrorToast).not.toHaveBeenCalledWith(
      'server.no-application-schema-found'
    );
    expect(screen.getByTestId('app-not-found')).toBeInTheDocument();
  });
});
