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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { updateSettingsConfig } from '../../rest/settingConfigAPI';
import AppearanceConfigSettingsPage from './AppearanceConfigSettingsPage';

const mockNavigate = jest.fn();

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <p>TitleBreadcrumb</p>);
  }
);

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../rest/settingConfigAPI', () => ({
  updateSettingsConfig: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

describe('Test appearance config page', () => {
  it('Should render the config page', async () => {
    render(<AppearanceConfigSettingsPage />);

    expect(screen.getByText('label.theme')).toBeInTheDocument();
    expect(
      screen.getByText('message.appearance-configuration-message')
    ).toBeInTheDocument();

    expect(screen.getByTestId('reset-button')).toBeInTheDocument();

    expect(screen.getByText('label.custom-logo')).toBeInTheDocument();
    expect(screen.getByTestId('customLogoUrlPath')).toBeInTheDocument();
    expect(screen.getByTestId('customMonogramUrlPath')).toBeInTheDocument();
    expect(screen.getByTestId('customFaviconUrlPath')).toBeInTheDocument();

    expect(screen.getByText('label.custom-theme')).toBeInTheDocument();

    expect(screen.getByTestId('primaryColor-color-input')).toBeInTheDocument();
    expect(screen.getByTestId('errorColor-color-input')).toBeInTheDocument();
    expect(screen.getByTestId('successColor-color-input')).toBeInTheDocument();
    expect(screen.getByTestId('warningColor-color-input')).toBeInTheDocument();
    expect(screen.getByTestId('infoColor-color-input')).toBeInTheDocument();

    expect(screen.getByTestId('primaryColor-color-picker')).toBeInTheDocument();
    expect(screen.getByTestId('errorColor-color-picker')).toBeInTheDocument();
    expect(screen.getByTestId('successColor-color-picker')).toBeInTheDocument();
    expect(screen.getByTestId('warningColor-color-picker')).toBeInTheDocument();
    expect(screen.getByTestId('infoColor-color-picker')).toBeInTheDocument();

    expect(screen.getByTestId('save-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
  });

  it('Should call goBack function on click of cancel button', async () => {
    render(<AppearanceConfigSettingsPage />);
    const cancelButton = await screen.findByTestId('cancel-btn');
    fireEvent.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('Should call updateSettingsConfig function on click of reset button', async () => {
    render(<AppearanceConfigSettingsPage />);
    const resetButton = await screen.findByTestId('reset-button');
    fireEvent.click(resetButton);

    expect(updateSettingsConfig).toHaveBeenCalled();
  });

  it('Form should work properly', async () => {
    render(<AppearanceConfigSettingsPage />);
    const customLogoUrlPath = screen.getByTestId('customLogoUrlPath');
    const customMonogramUrlPath = screen.getByTestId('customMonogramUrlPath');
    const customFaviconUrlPath = screen.getByTestId('customFaviconUrlPath');
    const primaryColorColorInput = screen.getByTestId(
      'primaryColor-color-input'
    );
    const errorColorColorInput = screen.getByTestId('errorColor-color-input');
    const successColorColorInput = screen.getByTestId(
      'successColor-color-input'
    );
    const warningColorColorInput = screen.getByTestId(
      'warningColor-color-input'
    );
    const infoColorColorInput = screen.getByTestId('infoColor-color-input');
    const saveButton = screen.getByTestId('save-btn');

    fireEvent.change(customLogoUrlPath, {
      target: { value: 'https://www.google.com' },
    });
    fireEvent.change(customMonogramUrlPath, {
      target: { value: 'https://www.google.com' },
    });
    fireEvent.change(customFaviconUrlPath, {
      target: { value: 'https://www.google.com' },
    });
    fireEvent.change(primaryColorColorInput, {
      target: { value: '#ffffff' },
    });
    fireEvent.change(errorColorColorInput, {
      target: { value: '#ffffff' },
    });
    fireEvent.change(successColorColorInput, {
      target: { value: '#ffffff' },
    });
    fireEvent.change(warningColorColorInput, {
      target: { value: '#ffffff' },
    });
    fireEvent.change(infoColorColorInput, {
      target: { value: '#ffffff' },
    });

    fireEvent.click(saveButton);

    await waitFor(() =>
      expect(updateSettingsConfig).toHaveBeenCalledWith({
        config_type: 'customUiThemePreference',
        config_value: {
          customLogoConfig: {
            customFaviconUrlPath: 'https://www.google.com',
            customLogoUrlPath: 'https://www.google.com',
            customMonogramUrlPath: 'https://www.google.com',
          },
          customTheme: {
            errorColor: '#ffffff',
            infoColor: '#ffffff',
            primaryColor: '#ffffff',
            successColor: '#ffffff',
            warningColor: '#ffffff',
          },
        },
      })
    );
  });
});
