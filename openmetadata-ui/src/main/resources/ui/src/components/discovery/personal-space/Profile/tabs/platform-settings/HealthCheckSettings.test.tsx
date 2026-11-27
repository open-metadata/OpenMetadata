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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { fetchOMStatus } from '../../../../../../rest/miscAPI';
import HealthCheckSettings from './HealthCheckSettings';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../rest/miscAPI', () => ({
  fetchOMStatus: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

let headerActions: ReactNode;
const onSetHeaderActions = jest.fn((actions: ReactNode) => {
  headerActions = actions;
});

const STATUS = {
  database: { passed: true, message: 'Connected to jdbc:mysql://db' },
  searchInstance: { passed: true, message: 'Connected to opensearch' },
  migrations: {
    passed: false,
    description: 'Validate that all migrations ran.',
    message: 'Missing migrations [1.9.1]',
  },
};

const renderPage = async () => {
  render(<HealthCheckSettings onSetHeaderActions={onSetHeaderActions} />);
  await act(async () => undefined);
};

describe('HealthCheckSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchOMStatus as jest.Mock).mockResolvedValue(STATUS);
  });

  it('summarises passing and failing checks', async () => {
    await renderPage();

    expect(screen.getByTestId('passing-count')).toHaveTextContent(
      '2 label.passing'
    );
    expect(screen.getByTestId('failing-count')).toHaveTextContent(
      '1 label.failed'
    );
  });

  it('shows the message for a passing check and the description for a failing one', async () => {
    await renderPage();

    expect(screen.getByTestId('database')).toHaveTextContent(
      'Connected to jdbc:mysql://db'
    );
    expect(screen.getByTestId('migrations')).toHaveTextContent(
      'Validate that all migrations ran.'
    );
    expect(screen.queryByTestId('health-check-logs')).not.toBeInTheDocument();
  });

  it('reveals the failure logs on demand', async () => {
    await renderPage();

    fireEvent.click(screen.getByTestId('toggle-logs'));

    expect(screen.getByTestId('health-check-logs')).toHaveTextContent(
      'Missing migrations [1.9.1]'
    );
  });

  it('re-runs the checks from the header Refresh action', async () => {
    await renderPage();
    render(<>{headerActions}</>);

    await act(async () => {
      fireEvent.click(screen.getByTestId('refresh-health-check'));
    });

    expect(fetchOMStatus).toHaveBeenCalledTimes(2);
  });
});
