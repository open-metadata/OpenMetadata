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
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { getSettingsConfigFromConfigType } from '../../rest/settingConfigAPI';
import CustomLogoConfigSettingsPage from './CustomLogoConfigSettingsPage';

const mockPush = jest.fn();

jest.mock('../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        config_value: {
          customLogoUrlPath: 'https://custom-logo.png',
          customMonogramUrlPath: 'https://custom-monogram.png',
        },
      },
    })
  ),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
}));

describe('Test Custom Logo Config Page', () => {
  it('Should render the config details', async () => {
    render(<CustomLogoConfigSettingsPage />);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    // page header
    expect(screen.getByText('label.custom-logo')).toBeInTheDocument();
    expect(
      screen.getByText('message.custom-logo-configuration-message')
    ).toBeInTheDocument();

    expect(screen.getByTestId('edit-button')).toBeInTheDocument();

    // logo
    expect(screen.getByText('label.logo-url')).toBeInTheDocument();
    expect(screen.getByTestId('logo-url-info')).toBeInTheDocument();
    expect(screen.getByTestId('logo-url')).toHaveTextContent(
      'https://custom-logo.png'
    );

    // monogram
    expect(screen.getByText('label.monogram-url')).toBeInTheDocument();
    expect(screen.getByTestId('monogram-url-info')).toBeInTheDocument();
    expect(screen.getByTestId('monogram-url')).toHaveTextContent(
      'https://custom-monogram.png'
    );
  });

  it('Should render the error placeholder if api fails', async () => {
    (getSettingsConfigFromConfigType as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    render(<CustomLogoConfigSettingsPage />);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(
      screen.getByTestId('create-error-placeholder-label.custom-logo')
    ).toBeInTheDocument();

    expect(screen.getByTestId('add-placeholder-button')).toBeInTheDocument();
  });

  it('Edit button should work', async () => {
    render(<CustomLogoConfigSettingsPage />);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    const editButton = screen.getByTestId('edit-button');

    expect(editButton).toBeInTheDocument();

    userEvent.click(editButton);

    expect(mockPush).toHaveBeenCalled();
  });
});
