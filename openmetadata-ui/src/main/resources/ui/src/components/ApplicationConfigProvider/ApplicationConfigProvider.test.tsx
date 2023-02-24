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
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { getApplicationConfig } from 'rest/miscAPI';
import ApplicationConfigProvider, {
  useApplicationConfigProvider,
} from './ApplicationConfigProvider';

const mockApplicationConfig = {
  logoConfig: {
    logoLocationType: 'openmetadata',
    loginPageLogoAbsoluteFilePath: '',
    loginPageLogoUrlPath: '',
    navBarLogoAbsoluteFilePath: '',
    navBarLogoUrlPath: '',
  },
  loginConfig: {
    maxLoginFailAttempts: 3,
    accessBlockTime: 600,
    jwtTokenExpiryTime: 3600,
  },
};

jest.mock('rest/miscAPI', () => ({
  getApplicationConfig: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockApplicationConfig)),
}));

describe('ApplicationConfigProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the children components', async () => {
    await act(async () => {
      render(
        <ApplicationConfigProvider>
          <div>Test Children</div>
        </ApplicationConfigProvider>
      );
    });

    expect(screen.getByText('Test Children')).toBeInTheDocument();
  });

  it('fetch the application config on mount and set in the context', async () => {
    function TestComponent() {
      const { logoConfig } = useApplicationConfigProvider();

      return <div>{logoConfig?.logoLocationType}</div>;
    }

    await act(async () => {
      render(
        <ApplicationConfigProvider>
          <TestComponent />
        </ApplicationConfigProvider>
      );
    });

    expect(await screen.findByText('openmetadata')).toBeInTheDocument();

    expect(getApplicationConfig).toHaveBeenCalledTimes(1);
  });
});
