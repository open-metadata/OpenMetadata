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
import { getDiagnosticInfo } from '../../../rest/observabilityAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import AlertAiDiagnosticTab from './AlertAiDiagnosticTab';

jest.mock('../../../rest/observabilityAPI', () => ({
  getDiagnosticInfo: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../utils/i18next/LocalUtil', () => ({
  t: (key: string) => key,
}));

const mockGetDiagnosticInfo = getDiagnosticInfo as jest.Mock;

describe('AlertAiDiagnosticTab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the offsets and processed state of the alert', async () => {
    mockGetDiagnosticInfo.mockResolvedValue({
      currentOffset: 10,
      failedEventsCount: 0,
      hasProcessedAllEvents: true,
      latestOffset: 12,
      startingOffset: 1,
      successfulEventsCount: 9,
    });

    render(<AlertAiDiagnosticTab fqn="my.alert" />);

    expect(mockGetDiagnosticInfo).toHaveBeenCalledWith('my.alert');

    await waitFor(() =>
      expect(
        screen.getByTestId('diagnostic-value-label.latest-offset')
      ).toHaveTextContent('12')
    );

    expect(
      screen.getByTestId('diagnostic-value-label.current-offset')
    ).toHaveTextContent('10');
    expect(
      screen.getByTestId('diagnostic-value-label.processed-all-event-plural')
    ).toHaveTextContent('label.yes');
  });

  it('shows a placeholder and a toast when the diagnostics fail to load', async () => {
    mockGetDiagnosticInfo.mockRejectedValue(new Error('boom'));

    render(<AlertAiDiagnosticTab fqn="my.alert" />);

    await waitFor(() =>
      expect(
        screen.getByTestId('diagnostic-value-label.latest-offset')
      ).toHaveTextContent('--')
    );

    expect(showErrorToast).toHaveBeenCalled();
  });
});
