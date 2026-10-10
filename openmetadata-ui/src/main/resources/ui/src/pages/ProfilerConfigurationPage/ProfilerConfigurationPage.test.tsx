/*
 *  Copyright 2024 Collate.
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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DataType,
  MetricType,
} from '../../generated/configuration/profilerConfiguration';
import { SettingType } from '../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import ProfilerConfigurationPage from './ProfilerConfigurationPage';
const mockNavigate = jest.fn();
jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => () => <div>Breadcrumb</div>
);
jest.mock('../../components/PageHeader/PageHeader.component', () => () => (
  <div>Profiler header</div>
));
jest.mock(
  '../../components/PageLayoutV1/PageLayoutV1',
  () =>
    ({ children }: { children: React.ReactNode }) =>
      <main>{children}</main>
);
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn(),
  updateSettingsConfig: jest.fn(),
}));
jest.mock('../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));
const config = {
  metricConfiguration: [
    {
      dataType: DataType.Int,
      metrics: Object.values(MetricType),
      disabled: false,
    },
  ],
  sampleDataConfig: { storeSampleData: false, readSampleData: false },
};
const user = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

describe('ProfilerConfigurationPage', () => {
  beforeEach(() => {
    (getSettingsConfigFromConfigType as jest.Mock).mockResolvedValue({
      data: { config_value: config },
    } as Awaited<ReturnType<typeof getSettingsConfigFromConfigType>>);
    (updateSettingsConfig as jest.Mock).mockResolvedValue(
      {} as Awaited<ReturnType<typeof updateSettingsConfig>>
    );
  });

  it('loads and saves unchanged metric selections and sample settings', async () => {
    render(<ProfilerConfigurationPage />);
    await user().click(await screen.findByTestId('save-button'));
    await waitFor(() =>
      expect(updateSettingsConfig).toHaveBeenCalledWith({
        config_type: SettingType.ProfilerConfiguration,
        config_value: config,
      })
    );
  });

  it('enabling sample storage also enables reading, while each can subsequently be changed', async () => {
    render(<ProfilerConfigurationPage />);
    await user().click(await screen.findByTestId('store-sample-data-switch'));

    expect(
      within(screen.getByTestId('read-sample-data-switch')).getByRole('switch')
    ).toBeChecked();

    await user().click(screen.getByTestId('store-sample-data-switch'));
    await user().click(screen.getByTestId('save-button'));
    await waitFor(() =>
      expect(updateSettingsConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          config_value: expect.objectContaining({
            sampleDataConfig: { storeSampleData: false, readSampleData: true },
          }),
        })
      )
    );
  });

  it('disabling a row keeps its configured metrics and disables its picker', async () => {
    render(<ProfilerConfigurationPage />);
    await user().click(await screen.findByTestId('disabled-switch'));

    expect(
      within(screen.getByTestId('metric-type-select')).getByRole('textbox', {
        name: 'label.metric-type',
      })
    ).toBeDisabled();

    await user().click(screen.getByTestId('save-button'));
    await waitFor(() =>
      expect(updateSettingsConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          config_value: expect.objectContaining({
            metricConfiguration: [
              { ...config.metricConfiguration[0], disabled: true },
            ],
          }),
        })
      )
    );
  });

  it('prevents duplicate data types and requires a type in new rows', async () => {
    render(<ProfilerConfigurationPage />);
    await user().click(await screen.findByTestId('add-fields'));
    const pickers = screen.getAllByTestId('data-type-select');
    await user().click(within(pickers[1]).getByRole('combobox'));

    expect(
      await screen.findByRole('option', { name: /^INT$/ })
    ).toHaveAttribute('aria-disabled', 'true');

    await user().keyboard('{Escape}');
    await user().click(screen.getByTestId('save-button'));

    expect(
      await screen.findByText('message.field-text-is-required')
    ).toBeVisible();
    expect(updateSettingsConfig).not.toHaveBeenCalled();

    await user().click(screen.getByTestId('remove-filter-1'));
    await user().click(screen.getByTestId('save-button'));
    await waitFor(() =>
      expect(updateSettingsConfig).toHaveBeenCalledWith({
        config_type: SettingType.ProfilerConfiguration,
        config_value: config,
      })
    );
  });

  it('cancel returns to the previous page', async () => {
    render(<ProfilerConfigurationPage />);
    await user().click(await screen.findByTestId('cancel-button'));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
