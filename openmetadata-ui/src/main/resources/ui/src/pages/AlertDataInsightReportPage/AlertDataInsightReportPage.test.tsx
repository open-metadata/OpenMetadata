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
import { MemoryRouter } from 'react-router-dom';
import { getAlertsFromName, triggerEventById } from '../../rest/alertsAPI';
import AlertDataInsightReportPage from './AlertDataInsightReportPage';

const MOCK_DATA_INSIGHTS_ALERT_DATA = {
  id: '6bb36fa4-55eb-448c-a96d-f635cce913fd',
  name: 'DataInsightReport',
  fullyQualifiedName: 'DataInsightReport',
  description:
    'Data Insight Report send to the admin (organization level) and teams (team level) at given interval.',
  href: 'http://localhost:8585/api/v1/events/subscriptions/6bb36fa4-55eb-448c-a96d-f635cce913fd',
  version: 0.1,
  updatedAt: 1683187040175,
  updatedBy: 'admin',
  alertType: 'DataInsightReport',
  trigger: {
    triggerType: 'Scheduled',
    scheduleInfo: 'Weekly',
  },
  subscriptionType: 'DataInsight',
  subscriptionConfig: {
    sendToTeams: true,
    sendToAdmins: true,
  },
  enabled: true,
  batchSize: 10,
  timeout: 10,
  readTimeout: 12,
  deleted: false,
  provider: 'system',
};

jest.mock('../../rest/alertsAPI', () => ({
  getAlertsFromName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_DATA_INSIGHTS_ALERT_DATA)),
  triggerEventById: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => ({ isAdminUser: true })),
}));

describe('Test Alert Data Insights Report Page', () => {
  it('Should render the child elements', async () => {
    render(<AlertDataInsightReportPage />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(screen.getByText('label.data-insight-report')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Data Insight Report send to the admin (organization level) and teams (team level) at given interval.'
      )
    ).toBeInTheDocument();

    expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    expect(screen.getByTestId('trigger')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-info')).toBeInTheDocument();
    expect(screen.getByTestId('destination')).toBeInTheDocument();
  });

  it('Should render data', async () => {
    render(<AlertDataInsightReportPage />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    const editButton = screen.getByTestId('edit-button');

    expect(editButton).toHaveAttribute(
      'href',
      `/settings/notifications/edit-data-insight-report/${MOCK_DATA_INSIGHTS_ALERT_DATA.id}`
    );

    expect(screen.getByTestId('trigger-type')).toHaveTextContent('Scheduled');
    expect(screen.getByTestId('schedule-info-type')).toHaveTextContent(
      'Weekly'
    );
    expect(screen.getByTestId('sendToAdmins')).toBeInTheDocument();
    expect(screen.getByTestId('sendToTeams')).toBeInTheDocument();
  });

  it('Should render the error placeholder if api fails or no data', async () => {
    (getAlertsFromName as jest.Mock).mockRejectedValueOnce(() =>
      Promise.reject()
    );
    render(<AlertDataInsightReportPage />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    expect(screen.getByTestId('no-data-image')).toBeInTheDocument();
    expect(screen.getByTestId('add-placeholder-button')).toBeInTheDocument();

    expect(
      screen.getByTestId('create-error-placeholder-label.data-insight-report')
    ).toBeInTheDocument();
  });

  it('Send Now button should work', async () => {
    const mockTrigger = triggerEventById as jest.Mock;
    render(<AlertDataInsightReportPage />, {
      wrapper: MemoryRouter,
    });

    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));

    const sendNowButton = screen.getByTestId('send-now-button');

    expect(sendNowButton).toBeInTheDocument();

    await act(async () => {
      userEvent.click(sendNowButton);
    });

    expect(mockTrigger).toHaveBeenCalledWith(MOCK_DATA_INSIGHTS_ALERT_DATA.id);
  });
});
