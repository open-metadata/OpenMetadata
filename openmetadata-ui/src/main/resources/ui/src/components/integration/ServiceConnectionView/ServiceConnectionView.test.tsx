/*
 *  Copyright 2025 Collate.
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

import { act, render, screen, waitFor } from '@testing-library/react';
import ServiceConnectionView from './ServiceConnectionView';

const mockGetServiceByFQN = jest.fn();
const mockShowErrorToast = jest.fn();

let mockParams = { serviceCategory: 'databaseServices', fqn: 'my-service' };

jest.mock('react-router-dom', () => ({
  useParams: () => mockParams,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../rest/serviceAPI', () => ({
  getServiceByFQN: (...args: unknown[]) => mockGetServiceByFQN(...args),
}));

jest.mock(
  '../../Settings/Services/ServiceConnectionDetails/ServiceConnectionDetails.component',
  () => ({
    __esModule: true,
    default: ({
      connectionDetails,
    }: {
      connectionDetails: unknown;
      serviceCategory: string;
      serviceFQN: string;
    }) => (
      <div data-testid="service-connection-details">
        {JSON.stringify(connectionDetails)}
      </div>
    ),
  })
);

jest.mock('../../common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
}));

const mockServiceWithConnection = {
  id: 'svc-1',
  name: 'my-service',
  serviceType: 'Mysql',
  connection: {
    config: { hostPort: 'localhost:3306', type: 'Mysql' },
  },
};

const mockServiceWithoutConnection = {
  id: 'svc-2',
  name: 'my-service',
  serviceType: 'Mysql',
};

describe('ServiceConnectionView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { serviceCategory: 'databaseServices', fqn: 'my-service' };
  });

  it('shows loader while fetching service', async () => {
    mockGetServiceByFQN.mockReturnValue(new Promise(() => {}));

    render(<ServiceConnectionView />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('calls getServiceByFQN with correct args', async () => {
    mockGetServiceByFQN.mockResolvedValue(mockServiceWithConnection);

    await act(async () => {
      render(<ServiceConnectionView />);
    });

    expect(mockGetServiceByFQN).toHaveBeenCalledWith(
      'databaseServices',
      'my-service',
      { fields: 'owners,connection' }
    );
  });

  it('renders ServiceConnectionDetails when connection.config present', async () => {
    mockGetServiceByFQN.mockResolvedValue(mockServiceWithConnection);

    await act(async () => {
      render(<ServiceConnectionView />);
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('service-connection-details')
      ).toBeInTheDocument();
    });
  });

  it('renders no-data message when connection.config absent', async () => {
    mockGetServiceByFQN.mockResolvedValue(mockServiceWithoutConnection);

    await act(async () => {
      render(<ServiceConnectionView />);
    });

    await waitFor(() => {
      expect(
        screen.getByText('label.no-connection-details')
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId('service-connection-details')
    ).not.toBeInTheDocument();
  });

  it('calls showErrorToast on API error', async () => {
    const error = new Error('API failed');
    mockGetServiceByFQN.mockRejectedValue(error);

    await act(async () => {
      render(<ServiceConnectionView />);
    });

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(error);
    });
  });

  it('decodes URL-encoded FQN from params', async () => {
    mockParams = {
      serviceCategory: 'databaseServices',
      fqn: 'org%2Fmy-service',
    };
    mockGetServiceByFQN.mockResolvedValue(mockServiceWithConnection);

    await act(async () => {
      render(<ServiceConnectionView />);
    });

    expect(mockGetServiceByFQN).toHaveBeenCalledWith(
      'databaseServices',
      'org/my-service',
      expect.anything()
    );
  });

  it('does not call getServiceByFQN when params missing', async () => {
    mockParams = { serviceCategory: '', fqn: '' };
    mockGetServiceByFQN.mockResolvedValue(mockServiceWithoutConnection);

    await act(async () => {
      render(<ServiceConnectionView />);
    });

    expect(mockGetServiceByFQN).not.toHaveBeenCalled();
  });
});
