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

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { EventSubscriptionDiagnosticInfo } from '../../../../../../generated/events/api/eventSubscriptionDiagnosticInfo';
import { getDiagnosticInfo } from '../../../../../../rest/observabilityAPI';
import NotificationDiagnosticInfo from './NotificationDiagnosticInfo';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Box: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  Typography: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
  Skeleton: jest.fn(() => <div data-testid="skeleton" />),
  ButtonUtility: jest.fn(({ tooltip }) => (
    <button data-testid="info-button">{tooltip}</button>
  )),
}));

jest.mock('@untitledui/icons', () => ({
  InfoCircle: jest.fn(() => <span />),
}));

const mockGetDiagnosticInfo = getDiagnosticInfo as jest.MockedFunction<
  typeof getDiagnosticInfo
>;

jest.mock('../../../../../../rest/observabilityAPI', () => ({
  getDiagnosticInfo: jest.fn(),
}));

jest.mock('../../../../../../utils/Alerts/AlertsUtilPure', () => ({
  getDiagnosticItems: jest.fn((data) =>
    data
      ? [
          { key: 'label.latest-offset', value: 100, description: 'desc1' },
          {
            key: 'label.current-offset',
            value: 50,
            description: 'desc2',
          },
        ]
      : []
  ),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockDiagnosticData: EventSubscriptionDiagnosticInfo = {
  latestOffset: 100,
  currentOffset: 50,
};

describe('NotificationDiagnosticInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render diagnostic items when data is provided via prop', () => {
    render(
      <NotificationDiagnosticInfo
        diagnosticData={mockDiagnosticData}
        fqn="test-fqn"
      />
    );

    expect(
      screen.getByTestId('diagnostic-info-container')
    ).toBeInTheDocument();
    expect(screen.getByText('label.latest-offset:')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should not call getDiagnosticInfo when prop data is provided', () => {
    render(
      <NotificationDiagnosticInfo
        diagnosticData={mockDiagnosticData}
        fqn="test-fqn"
      />
    );

    expect(mockGetDiagnosticInfo).not.toHaveBeenCalled();
  });

  it('should show loading skeleton when fetching data', () => {
    mockGetDiagnosticInfo.mockReturnValue(new Promise(() => {}));

    render(<NotificationDiagnosticInfo fqn="test-fqn" />);

    expect(screen.getAllByTestId('skeleton')).toHaveLength(6);
  });

  it('should fetch diagnostic info when no prop data provided', async () => {
    mockGetDiagnosticInfo.mockResolvedValue(mockDiagnosticData);

    render(<NotificationDiagnosticInfo fqn="test-fqn" />);

    await waitFor(() => {
      expect(mockGetDiagnosticInfo).toHaveBeenCalledWith('test-fqn');
    });
  });
});
