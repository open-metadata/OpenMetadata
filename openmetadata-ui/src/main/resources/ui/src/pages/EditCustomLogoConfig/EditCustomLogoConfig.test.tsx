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
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { updateSettingsConfig } from '../../rest/settingConfigAPI';
import EditCustomLogoConfig from './EditCustomLogoConfig';

const mockPush = jest.fn();
const mockGoBack = jest.fn();

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
    goBack: mockGoBack,
  })),
}));

jest.mock('../../components/MyData/LeftSidebar/LeftSidebar.component', () =>
  jest.fn().mockReturnValue(<p>Sidebar</p>)
);

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
  updateSettingsConfig: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockImplementation(() => <div>BreadCrumb.component</div>)
);
jest.mock('../../components/common/ServiceDocPanel/ServiceDocPanel', () =>
  jest.fn().mockImplementation(() => <div>ServiceDocPanel.component</div>)
);

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

describe('Test Custom Logo Config Form', () => {
  it('Should render the child components', async () => {
    render(<EditCustomLogoConfig />);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    // breadcrumb
    expect(screen.getByText('BreadCrumb.component')).toBeInTheDocument();

    // service doc panel
    expect(screen.getByText('ServiceDocPanel.component')).toBeInTheDocument();

    // form
    expect(screen.getByTestId('custom-logo-config-form')).toBeInTheDocument();
  });

  it('Should render the form with default values', async () => {
    render(<EditCustomLogoConfig />);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    // form
    expect(screen.getByTestId('custom-logo-config-form')).toBeInTheDocument();

    // logo url input
    expect(screen.getByTestId('customLogoUrlPath')).toHaveValue(
      'https://custom-logo.png'
    );

    // monogram url input
    expect(screen.getByTestId('customMonogramUrlPath')).toHaveValue(
      'https://custom-monogram.png'
    );
  });

  it('Cancel button should work', async () => {
    render(<EditCustomLogoConfig />);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    const cancelButton = screen.getByTestId('cancel-button');

    userEvent.click(cancelButton);

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('Save button should work', async () => {
    render(<EditCustomLogoConfig />);

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    const logoInput = screen.getByTestId('customLogoUrlPath');
    const monogramInput = screen.getByTestId('customMonogramUrlPath');

    await act(async () => {
      userEvent.type(logoInput, 'https://custom-logo-1.png');
      userEvent.type(monogramInput, 'https://custom-monogram-1.png');
    });

    const saveButton = screen.getByTestId('save-button');

    await act(async () => {
      userEvent.click(saveButton);
    });

    expect(updateSettingsConfig).toHaveBeenCalledWith({
      config_type: 'customLogoConfiguration',
      config_value: {
        customLogoUrlPath: 'https://custom-logo-1.png',
        customMonogramUrlPath: 'https://custom-monogram-1.png',
      },
    });
  });
});
