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
import { ReactNode } from 'react';
import { SettingType } from '../../../../../../generated/settings/settings';
import { updateSettingsConfig } from '../../../../../../rest/settingConfigAPI';
import ThemeSettings from './ThemeSettings';
import { EMPTY_THEME_CONFIG } from './ThemeSettings.utils';
import ThemeSettingsForm from './ThemeSettingsForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  updateSettingsConfig: jest.fn(),
}));

jest.mock('../../../../../../utils/DataQuality/FormFieldDocs', () => ({
  loadFormFieldDocs: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/BrandImage/BrandImage', () =>
  jest.fn(({ dataTestId, src }) => (
    <img alt="" data-testid={dataTestId} src={src} />
  ))
);

const mockSetApplicationConfig = jest.fn();
const APPLICATION_CONFIG = {
  customLogoConfig: {
    customLogoUrlPath: 'https://cdn.example.com/logo.svg',
    customMonogramUrlPath: '',
    customFaviconUrlPath: '',
  },
  customTheme: {
    primaryColor: '#1570ef',
    hoverColor: '#d1e9ff',
    selectedColor: '#175cd3',
    errorColor: '#d92d20',
    successColor: '#039855',
    warningColor: '#f79009',
    infoColor: '#2e90fa',
    panelBackgroundColor: '',
  },
};

jest.mock('../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    applicationConfig: APPLICATION_CONFIG,
    setApplicationConfig: mockSetApplicationConfig,
  }),
}));

const onNavigate = jest.fn();
let headerActions: ReactNode;
const onSetHeaderActions = (actions: ReactNode) => {
  headerActions = actions;
};

const colorInput = (name: string) =>
  screen.getByTestId(`${name}-color-input`) as HTMLInputElement;

describe('Theme settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (updateSettingsConfig as jest.Mock).mockResolvedValue({ data: {} });
  });

  it('shows the live logo URLs and colours, with "Not set" for blanks', () => {
    render(
      <ThemeSettings
        onNavigate={onNavigate}
        onSetHeaderActions={onSetHeaderActions}
      />
    );

    expect(screen.getByTestId('customLogoUrlPath-value')).toHaveTextContent(
      'https://cdn.example.com/logo.svg'
    );
    expect(screen.getByTestId('customMonogramUrlPath-value')).toHaveTextContent(
      'label.not-set'
    );
    expect(screen.getByTestId('primaryColor-value')).toHaveTextContent(
      '#1570ef'
    );
    expect(screen.getByTestId('panelBackgroundColor-value')).toHaveTextContent(
      'label.not-set'
    );
  });

  it('Reset clears every logo and colour', async () => {
    render(
      <ThemeSettings
        onNavigate={onNavigate}
        onSetHeaderActions={onSetHeaderActions}
      />
    );
    render(<>{headerActions}</>);

    await act(async () => {
      fireEvent.click(screen.getByTestId('reset-button'));
    });

    expect(updateSettingsConfig).toHaveBeenCalledWith({
      config_type: SettingType.CustomUIThemePreference,
      config_value: EMPTY_THEME_CONFIG,
    });
    expect(mockSetApplicationConfig).toHaveBeenCalled();
  });

  it('picking a primary colour re-derives hover and selected', async () => {
    render(<ThemeSettingsForm showHint={false} onNavigate={onNavigate} />);

    fireEvent.change(colorInput('primaryColor'), {
      target: { value: '#7f56d9' },
    });

    await waitFor(() =>
      expect(colorInput('hoverColor')).not.toHaveValue('#d1e9ff')
    );

    expect(colorInput('selectedColor')).not.toHaveValue('#175cd3');
  });

  it('rejects an invalid HEX code and an invalid logo URL', async () => {
    render(<ThemeSettingsForm showHint={false} onNavigate={onNavigate} />);

    fireEvent.change(colorInput('errorColor'), { target: { value: 'red' } });
    fireEvent.change(
      screen
        .getByTestId('customFaviconUrlPath')
        .querySelector('input') as HTMLInputElement,
      { target: { value: 'favicon.ico' } }
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(
      await screen.findByText('message.hex-color-validation')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.entity-is-not-valid-url')
    ).toBeInTheDocument();
    expect(updateSettingsConfig).not.toHaveBeenCalled();
  });

  it('saves the theme, updates the live app config and returns to the view', async () => {
    render(<ThemeSettingsForm showHint={false} onNavigate={onNavigate} />);

    fireEvent.change(colorInput('infoColor'), { target: { value: '#123456' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    const payload = (updateSettingsConfig as jest.Mock).mock.calls[0][0];

    expect(payload.config_type).toBe(SettingType.CustomUIThemePreference);
    expect(payload.config_value.customTheme.infoColor).toBe('#123456');
    expect(payload.config_value.customLogoConfig.customLogoUrlPath).toBe(
      'https://cdn.example.com/logo.svg'
    );
    expect(mockSetApplicationConfig).toHaveBeenCalledWith(payload.config_value);
    expect(onNavigate).toHaveBeenCalledWith({
      type: 'page',
      page: 'theme',
      isEditing: false,
    });
  });
});
