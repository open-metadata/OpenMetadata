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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { values } from 'lodash';
import {
  DataType,
  MetricType,
} from '../../../../../../generated/configuration/profilerConfiguration';
import { SettingType } from '../../../../../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
} from '../../../../../../rest/settingConfigAPI';
import ProfilerSettings from './ProfilerSettings';
import ProfilerSettingsForm from './ProfilerSettingsForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn(),
  updateSettingsConfig: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const mockSparkConfig = jest.fn();

jest.mock(
  '../../../../../../pages/ProfilerConfigurationPage/ProfilerConfigurationClassBase',
  () => ({
    getSparkAgentConfigComponent: () => mockSparkConfig(),
  })
);

const onNavigate = jest.fn();
const STORED = {
  metricConfiguration: [
    { dataType: DataType.Int, metrics: values(MetricType) },
    {
      dataType: DataType.Array,
      metrics: [MetricType.Max],
      disabled: true,
    },
  ],
  sampleDataConfig: { storeSampleData: false, readSampleData: true },
};

const mockStored = (configValue?: unknown) =>
  (getSettingsConfigFromConfigType as jest.Mock).mockResolvedValue({
    data: { config_value: configValue },
  });

describe('Profiler configuration settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSparkConfig.mockReturnValue(undefined);
    (updateSettingsConfig as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('view shows each data type, "All" for a full set and the disabled state', async () => {
    mockStored(STORED);
    render(
      <ProfilerSettings
        onNavigate={onNavigate}
        onSetHeaderActions={jest.fn()}
      />
    );

    const intRow = await screen.findByTestId('metric-row-INT');

    expect(intRow).toHaveTextContent('label.all');
    expect(screen.getByTestId('metric-row-ARRAY')).toHaveTextContent(
      'label.disabled'
    );
    expect(screen.getByTestId('store-sample-data-value')).toHaveTextContent(
      'label.disabled'
    );
    expect(screen.getByTestId('read-sample-data-value')).toHaveTextContent(
      'label.enabled'
    );
  });

  it('view falls back to the defaults and renders the Collate Spark section when present', async () => {
    mockStored(undefined);
    mockSparkConfig.mockReturnValue(() => <div data-testid="spark-config" />);
    render(
      <ProfilerSettings
        onNavigate={onNavigate}
        onSetHeaderActions={jest.fn()}
      />
    );

    expect(
      await screen.findByTestId('metric-configuration-empty')
    ).toBeInTheDocument();
    expect(screen.getByTestId('store-sample-data-value')).toHaveTextContent(
      'label.enabled'
    );
    expect(screen.getByTestId('spark-config')).toBeInTheDocument();
  });

  it('form saves rows, expanding "All" to every metric, and returns to the view', async () => {
    mockStored(STORED);
    render(<ProfilerSettingsForm showHint={false} onNavigate={onNavigate} />);
    await screen.findByTestId('metric-row-1');

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(updateSettingsConfig).toHaveBeenCalledWith({
      config_type: SettingType.ProfilerConfiguration,
      config_value: {
        metricConfiguration: [
          {
            dataType: DataType.Int,
            metrics: values(MetricType),
            disabled: false,
          },
          {
            dataType: DataType.Array,
            metrics: [MetricType.Max],
            disabled: true,
          },
        ],
        // Storing is off, so reading keeps its own stored value.
        sampleDataConfig: { storeSampleData: false, readSampleData: true },
      },
    });
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'profiler-configuration',
      isEditing: false,
    });
  });

  it('removing a row drops it from the saved configuration', async () => {
    mockStored(STORED);
    render(<ProfilerSettingsForm showHint={false} onNavigate={onNavigate} />);
    await screen.findByTestId('metric-row-1');

    fireEvent.click(screen.getByTestId('remove-filter-0'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    const payload = (updateSettingsConfig as jest.Mock).mock.calls[0][0];

    expect(payload.config_value.metricConfiguration).toEqual([
      { dataType: DataType.Array, metrics: [MetricType.Max], disabled: true },
    ]);
  });

  it('a new row needs a data type before it can be saved', async () => {
    mockStored(STORED);
    render(<ProfilerSettingsForm showHint={false} onNavigate={onNavigate} />);
    await screen.findByTestId('metric-row-1');

    fireEvent.click(screen.getByTestId('add-fields'));
    await waitFor(() =>
      expect(screen.getByTestId('metric-row-2')).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(
      await screen.findByText('message.field-text-is-required')
    ).toBeInTheDocument();
    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });

  it('enabling storage of sample data also enables reading it', async () => {
    mockStored({
      ...STORED,
      sampleDataConfig: { storeSampleData: false, readSampleData: false },
    });
    render(<ProfilerSettingsForm showHint={false} onNavigate={onNavigate} />);
    await screen.findByTestId('metric-row-1');

    fireEvent.click(
      screen.getByTestId('store-sample-data-switch').querySelector('input') ??
        screen.getByTestId('store-sample-data-switch')
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    const payload = (updateSettingsConfig as jest.Mock).mock.calls[0][0];

    expect(payload.config_value.sampleDataConfig).toEqual({
      storeSampleData: true,
      readSampleData: true,
    });
  });
});
