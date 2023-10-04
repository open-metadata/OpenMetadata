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
import { act, getByTitle, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { updateAlert } from '../../rest/alertsAPI';
import AddDataInsightReportAlert from './AddDataInsightReportAlert';

let fqn = '';
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('../../components/common/rich-text-editor/RichTextEditor', () => {
  return jest.fn().mockImplementation(({ initialValue }) => (
    <div data-testid="editor">
      <textarea data-testid="description" value={initialValue} />
    </div>
  ));
});

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
    goBack: mockBack,
  })),
  useParams: jest.fn().mockImplementation(() => ({
    fqn,
  })),
}));

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
  ...jest.requireActual('../../rest/alertsAPI'),
  updateAlert: jest.fn().mockImplementation(() => Promise.resolve()),
  createAlert: jest.fn().mockImplementation(() => Promise.resolve()),
  getAlertsFromId: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_DATA_INSIGHTS_ALERT_DATA)),
}));

jest.mock('../../utils/Alerts/AlertsUtil', () => ({
  StyledCard: jest.fn().mockReturnValue(<div>StyleCard</div>),
}));

describe('Test Add Data Insight Report Alert', () => {
  it('Should render the child elements for add operation', async () => {
    render(<AddDataInsightReportAlert />, { wrapper: MemoryRouter });

    expect(screen.getByText('label.create-entity')).toBeInTheDocument();
    expect(screen.getByTestId('name')).toBeInTheDocument();
    expect(screen.getByTestId('description')).toBeInTheDocument();
    expect(screen.getByTestId('triggerType')).toBeInTheDocument();
    expect(screen.getByTestId('scheduleInfo')).toBeInTheDocument();
    expect(screen.getByTestId('sendToAdmins')).toBeInTheDocument();
    expect(screen.getByTestId('sendToTeams')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('Should render the child elements for edit operation', async () => {
    fqn = '6bb36fa4-55eb-448c-a96d-f635cce913fd';

    await act(async () => {
      render(<AddDataInsightReportAlert />, { wrapper: MemoryRouter });
    });

    expect(screen.getByText('label.edit-entity')).toBeInTheDocument();

    const nameInput = screen.getByTestId('name');

    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveValue('DataInsightReport');
    expect(nameInput).toBeDisabled();

    expect(screen.getByTestId('description')).toHaveValue(
      MOCK_DATA_INSIGHTS_ALERT_DATA.description
    );

    const triggerType = screen.getByTestId('triggerType');

    expect(
      getByTitle(triggerType, MOCK_DATA_INSIGHTS_ALERT_DATA.trigger.triggerType)
    ).toBeInTheDocument();

    const scheduleInfo = screen.getByTestId('scheduleInfo');

    expect(
      getByTitle(
        scheduleInfo,
        MOCK_DATA_INSIGHTS_ALERT_DATA.trigger.scheduleInfo
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('sendToAdmins')).toBeChecked();
    expect(screen.getByTestId('sendToTeams')).toBeChecked();
  });

  it('Cancel Should work', async () => {
    fqn = '';
    render(<AddDataInsightReportAlert />, { wrapper: MemoryRouter });

    const cancelButton = screen.getByTestId('cancel-button');

    act(() => {
      userEvent.click(cancelButton);
    });

    expect(mockBack).toHaveBeenCalled();
  });

  it('Save Should work', async () => {
    fqn = '6bb36fa4-55eb-448c-a96d-f635cce913fd';

    await act(async () => {
      render(<AddDataInsightReportAlert />, { wrapper: MemoryRouter });
    });

    expect(screen.getByText('label.edit-entity')).toBeInTheDocument();

    const saveButton = screen.getByTestId('save-button');

    await act(async () => {
      userEvent.click(saveButton);
    });

    expect(updateAlert).toHaveBeenCalledWith({
      alertType: 'DataInsightReport',
      description:
        'Data Insight Report send to the admin (organization level) and teams (team level) at given interval.',
      name: 'DataInsightReport',
      subscriptionConfig: {
        sendToAdmins: true,
        sendToTeams: true,
      },
      subscriptionType: 'DataInsight',
      trigger: {
        scheduleInfo: 'Weekly',
        triggerType: 'Scheduled',
      },
      enabled: true,
      provider: 'system',
    });
    expect(mockPush).toHaveBeenCalled();
  });
});
