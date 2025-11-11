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

import { render, screen, waitFor } from '@testing-library/react';
import { AxiosError } from 'axios';
import { getAirflowStatus } from '../../rest/ingestionPipelineAPI';
import AirflowStatusProvider, {
  useAirflowStatus,
} from './AirflowStatusProvider';

// Mock the API call
jest.mock('../../rest/ingestionPipelineAPI', () => ({
  getAirflowStatus: jest.fn(),
}));

jest.mock('../../hooks/useApplicationStore', () => {
  return {
    useApplicationStore: jest.fn().mockImplementation(() => ({
      currentUser: {
        id: '123',
      },
    })),
  };
});

// Mock component to test the context
const TestComponent = () => {
  const {
    isFetchingStatus,
    isAirflowAvailable,
    error,
    reason,
    platform,
    fetchAirflowStatus,
  } = useAirflowStatus();

  return (
    <div>
      <div data-testid="isFetchingStatus">{isFetchingStatus?.toString()}</div>
      <div data-testid="isAirflowAvailable">
        {isAirflowAvailable?.toString()}
      </div>
      <div data-testid="error">{error ? 'error' : 'no-error'}</div>
      <div data-testid="reason">{reason}</div>
      <div data-testid="platform">{platform}</div>
      <button onClick={fetchAirflowStatus}>Refresh</button>
    </div>
  );
};

describe('AirflowStatusProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with default values', async () => {
    (getAirflowStatus as jest.Mock).mockResolvedValueOnce({
      code: 200,
      reason: 'Airflow is running',
      platform: 'managed',
    });

    render(
      <AirflowStatusProvider>
        <TestComponent />
      </AirflowStatusProvider>
    );

    // Initial loading state
    expect(screen.getByTestId('isFetchingStatus').textContent).toBe('true');
    expect(screen.getByTestId('isAirflowAvailable').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe('no-error');

    // Wait for the API call to complete
    await waitFor(() => {
      expect(screen.getByTestId('isFetchingStatus').textContent).toBe('false');
      expect(screen.getByTestId('isAirflowAvailable').textContent).toBe('true');
      expect(screen.getByTestId('reason').textContent).toBe(
        'Airflow is running'
      );
      expect(screen.getByTestId('platform').textContent).toBe('managed');
    });
  });

  it('should handle API error', async () => {
    const mockError = new Error('API Error') as AxiosError;
    (getAirflowStatus as jest.Mock).mockRejectedValueOnce(mockError);

    render(
      <AirflowStatusProvider>
        <TestComponent />
      </AirflowStatusProvider>
    );

    // Initial loading state
    expect(screen.getByTestId('isFetchingStatus').textContent).toBe('true');
    expect(screen.getByTestId('isAirflowAvailable').textContent).toBe('false');
    expect(screen.getByTestId('error').textContent).toBe('no-error');

    // Wait for the API call to complete
    await waitFor(() => {
      expect(screen.getByTestId('isFetchingStatus').textContent).toBe('false');
      expect(screen.getByTestId('isAirflowAvailable').textContent).toBe(
        'false'
      );
      expect(screen.getByTestId('error').textContent).toBe('error');
    });
  });

  it('should handle non-200 response code', async () => {
    (getAirflowStatus as jest.Mock).mockResolvedValueOnce({
      code: 500,
      reason: 'Airflow is not running',
      platform: 'unknown',
    });

    render(
      <AirflowStatusProvider>
        <TestComponent />
      </AirflowStatusProvider>
    );

    // Wait for the API call to complete
    await waitFor(() => {
      expect(screen.getByTestId('isFetchingStatus').textContent).toBe('false');
      expect(screen.getByTestId('isAirflowAvailable').textContent).toBe(
        'false'
      );
      expect(screen.getByTestId('reason').textContent).toBe(
        'Airflow is not running'
      );
      expect(screen.getByTestId('platform').textContent).toBe('unknown');
    });
  });

  it('should allow refreshing the status', async () => {
    (getAirflowStatus as jest.Mock)
      .mockResolvedValueOnce({
        code: 200,
        reason: 'Initial status',
        platform: 'managed',
      })
      .mockResolvedValueOnce({
        code: 200,
        reason: 'Refreshed status',
        platform: 'managed',
      });

    render(
      <AirflowStatusProvider>
        <TestComponent />
      </AirflowStatusProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('reason').textContent).toBe('Initial status');
    });

    // Click refresh button
    screen.getByText('Refresh').click();

    // Wait for refresh
    await waitFor(() => {
      expect(screen.getByTestId('reason').textContent).toBe('Refreshed status');
    });
  });
});
