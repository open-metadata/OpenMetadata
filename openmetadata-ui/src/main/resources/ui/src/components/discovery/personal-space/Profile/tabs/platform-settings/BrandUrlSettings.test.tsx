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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { SettingType } from '../../../../../../generated/settings/settings';
import { SettingType as SourceSettingType } from '../../../../../../generated/system/settingsSourceResponse';
import {
  getSettingsConfigFromConfigType,
  getSettingsSource,
  updateSettingsConfig,
} from '../../../../../../rest/settingConfigAPI';
import BrandUrlSettings from './BrandUrlSettings';
import BrandUrlSettingsForm from './BrandUrlSettingsForm';
import { deploymentOwnedSource } from './PlatformSettings.mock';
import { renderWithQueryClient } from '../../../../../../test/unit/test-utils';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../utils/DataQuality/FormFieldDocs', () => ({
  loadFormFieldDocs: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  getSettingsSource: jest.fn().mockResolvedValue({ settings: [] }),
  adoptDeploymentConfig: jest.fn(),
  getSettingsConfigFromConfigType: jest.fn(),
  updateSettingsConfig: jest.fn(),
}));

const onNavigate = jest.fn();
let headerActions: ReactNode;
const onSetHeaderActions = (actions: ReactNode) => {
  headerActions = actions;
};

const urlInput = () =>
  screen
    .getByTestId('open-metadata-url-input')
    .querySelector('input') as HTMLInputElement;

describe('Brand URL settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    headerActions = undefined;
    (getSettingsSource as jest.Mock).mockResolvedValue({ settings: [] });
    (getSettingsConfigFromConfigType as jest.Mock).mockResolvedValue({
      data: { config_value: { openMetadataUrl: 'http://localhost:8585' } },
    });
    (updateSettingsConfig as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('shows the stored URL and opens the edit view', async () => {
    renderWithQueryClient(
      <BrandUrlSettings
        onNavigate={onNavigate}
        onSetHeaderActions={onSetHeaderActions}
      />
    );

    expect(await screen.findByTestId('open-metadata-url')).toHaveTextContent(
      'http://localhost:8585'
    );

    render(<>{headerActions}</>);
    fireEvent.click(screen.getByTestId('edit-button'));

    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'brand-url',
      isEditing: true,
    });
  });

  it('rejects an invalid URL', async () => {
    renderWithQueryClient(
      <BrandUrlSettingsForm showHint={false} onNavigate={onNavigate} />
    );
    await waitFor(() =>
      expect(urlInput()).toHaveValue('http://localhost:8585')
    );

    fireEvent.change(urlInput(), { target: { value: 'not a url' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(updateSettingsConfig).not.toHaveBeenCalled();
    expect(urlInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('saves a valid URL and returns to the view', async () => {
    renderWithQueryClient(
      <BrandUrlSettingsForm showHint={false} onNavigate={onNavigate} />
    );
    await waitFor(() =>
      expect(urlInput()).toHaveValue('http://localhost:8585')
    );

    fireEvent.change(urlInput(), {
      target: { value: 'https://metadata.example.com' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(updateSettingsConfig).toHaveBeenCalledWith({
      config_type: SettingType.OpenMetadataBaseURLConfiguration,
      config_value: { openMetadataUrl: 'https://metadata.example.com' },
    });
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'brand-url',
      isEditing: false,
    });
  });
});

describe('Brand URL settings set by the deployment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    headerActions = undefined;
    (getSettingsConfigFromConfigType as jest.Mock).mockResolvedValue({
      data: { config_value: { openMetadataUrl: 'https://om.example.com' } },
    });
    (getSettingsSource as jest.Mock).mockResolvedValue({
      settings: [
        deploymentOwnedSource(
          SourceSettingType.OpenMetadataBaseURLConfiguration,
          ['/openMetadataUrl']
        ),
      ],
    });
  });

  it('says so and offers no edit', async () => {
    renderWithQueryClient(
      <BrandUrlSettings
        onNavigate={onNavigate}
        onSetHeaderActions={onSetHeaderActions}
      />
    );

    expect(
      await screen.findByTestId('settings-source-env-alert')
    ).toBeInTheDocument();

    render(<>{headerActions}</>);

    expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
  });

  it('locks the URL and Save in the form', async () => {
    renderWithQueryClient(
      <BrandUrlSettingsForm showHint={false} onNavigate={onNavigate} />
    );
    await screen.findByTestId('settings-source-env-alert');

    await waitFor(() => expect(urlInput()).toBeDisabled());

    expect(screen.getByTestId('save-button')).toBeDisabled();
  });
});
