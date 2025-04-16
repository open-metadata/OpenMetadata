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
import { act, render, screen } from '@testing-library/react';
import {
  mockDiagnosticData,
  mockEmptyDiagnosticData,
} from '../../../../mocks/Alerts.mock';
import { getDiagnosticInfo } from '../../../../rest/observabilityAPI';
import AlertDiagnosticInfoTab from './AlertDiagnosticInfoTab';

// Mock the API call
jest.mock('../../../../rest/observabilityAPI', () => ({
  getDiagnosticInfo: jest.fn(),
}));

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test-fqn' }),
}));

describe('AlertDiagnosticInfoTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all offset information correctly', async () => {
    (getDiagnosticInfo as jest.Mock).mockResolvedValue(mockDiagnosticData);

    await act(async () => {
      render(<AlertDiagnosticInfoTab />);
    });

    // Check labels
    expect(screen.getByText('label.latest-offset:')).toBeInTheDocument();
    expect(screen.getByText('label.current-offset:')).toBeInTheDocument();
    expect(screen.getByText('label.starting-offset:')).toBeInTheDocument();
    expect(
      screen.getByText('label.successful-event-plural:')
    ).toBeInTheDocument();
    expect(screen.getByText('label.failed-event-plural:')).toBeInTheDocument();
    expect(
      screen.getByText('label.processed-all-event-plural:')
    ).toBeInTheDocument();

    // Check values
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('should render processed all events status as "No" when false', async () => {
    (getDiagnosticInfo as jest.Mock).mockResolvedValue(mockEmptyDiagnosticData);

    await act(async () => {
      render(<AlertDiagnosticInfoTab />);
    });

    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('should render with empty/zero values correctly', async () => {
    (getDiagnosticInfo as jest.Mock).mockResolvedValue(mockEmptyDiagnosticData);

    await act(async () => {
      render(<AlertDiagnosticInfoTab />);
    });

    // Check numeric fields have value "0"
    const zeroValues = screen.getAllByText('0');

    expect(zeroValues).toHaveLength(5); // Should find 5 zero values
  });

  it('should handle API error correctly', async () => {
    const error = new Error('API Error');
    (getDiagnosticInfo as jest.Mock).mockRejectedValue(error);

    await act(async () => {
      render(<AlertDiagnosticInfoTab />);
    });

    expect(screen.queryByText('100')).not.toBeInTheDocument();
  });
});
