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
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConnectionStepCard from '../../components/common/TestConnection/ConnectionStepCard/ConnectionStepCard';
import { fetchOMStatus } from '../../rest/miscAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import OmHealthPage from './OmHealthPage';

jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn(() => <p>Loader</p>);
});

jest.mock(
  '../../components/common/TestConnection/ConnectionStepCard/ConnectionStepCard',
  () => {
    return jest.fn().mockImplementation(() => jest.fn());
  }
);
jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn(() => <p>TitleBreadcrumb</p>);
  }
);
jest.mock('../../components/PageHeader/PageHeader.component', () => {
  return jest.fn(() => <p>PageHeader</p>);
});
jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn(({ children }) => <div>{children}</div>);
});

jest.mock('../../rest/miscAPI');
jest.mock('../../utils/GlobalSettingsUtils');
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('OmHealthPage', () => {
  it('should render loader while loading', () => {
    render(<OmHealthPage />, { wrapper: MemoryRouter });

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });

  it('should render health data after loading', async () => {
    const mockData = {
      validation1: {
        description: 'Validation 1',
        passed: true,
      },
      validation2: {
        description: 'Validation 2',
        passed: false,
      },
    };
    (fetchOMStatus as jest.Mock).mockResolvedValueOnce({ data: mockData });

    await act(async () => {
      render(<OmHealthPage />, { wrapper: MemoryRouter });
    });

    expect(ConnectionStepCard).toHaveBeenCalledWith(
      {
        isTestingConnection: false,
        testConnectionStep: { description: '', mandatory: true, name: 'Data' },
        testConnectionStepResult: {
          errorLog: undefined,
          mandatory: true,
          message: undefined,
          name: 'Data',
          passed: false,
        },
      },
      {}
    );
  });

  it('should handle error while fetching health data', async () => {
    const mockError = new Error('Failed to fetch health data');
    (fetchOMStatus as jest.Mock).mockRejectedValueOnce(mockError);

    await act(async () => {
      render(<OmHealthPage />, { wrapper: MemoryRouter });
    });

    expect(showErrorToast).toHaveBeenCalledWith(mockError);
  });

  it('should refresh health data on button click', async () => {
    const mockData = {
      validation1: {
        description: 'Validation 1',
        passed: true,
      },
    };
    (fetchOMStatus as jest.Mock)
      .mockResolvedValueOnce({ data: mockData })
      .mockResolvedValueOnce({ data: {} });

    await act(async () => {
      render(<OmHealthPage />, { wrapper: MemoryRouter });
    });

    expect(ConnectionStepCard).toHaveBeenCalledWith(
      {
        isTestingConnection: false,
        testConnectionStep: { description: '', mandatory: true, name: 'Data' },
        testConnectionStepResult: {
          errorLog: undefined,
          mandatory: true,
          message: undefined,
          name: 'Data',
          passed: false,
        },
      },
      {}
    );

    const refreshButton = screen.getByText('label.refresh');
    refreshButton.click();

    expect(fetchOMStatus).toHaveBeenCalledTimes(2);
  });
});
