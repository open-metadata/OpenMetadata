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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddNotificationPage from './AddNotificationPage';

const mockNavigate = jest.fn();

jest.mock('../../rest/alertsAPI', () => ({
  getAlertsFromName: jest.fn().mockImplementation(() =>
    Promise.resolve({
      name: 'ActivityFeedAlert',
    })
  ),
  getResourceFunctions: jest.fn(),
  updateNotificationAlert: jest.fn().mockImplementation(() =>
    Promise.resolve({
      id: 'ActivityFeedAlert',
      data: [],
    })
  ),
  createNotificationAlert: jest.fn().mockImplementation(() =>
    Promise.resolve({
      alert: 'Notification',
    })
  ),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getNotificationAlertDetailsPath: jest.fn(),
  getSettingPath: jest.fn(),
}));

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: '' }),
}));

const mockProps = {
  pageTitle: 'add-notifications',
};

describe('AddNotificationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render Add Notification Page', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      await screen.findByText('label.notification-plural')
    ).toBeInTheDocument();
  });

  it('should display the correct breadcrumb', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });
    const breadcrumbLinks = screen.getAllByTestId('breadcrumb-link');

    expect(breadcrumbLinks[0]).toHaveTextContent('label.setting-plural');
    expect(breadcrumbLinks[1]).toHaveTextContent('label.notification-plural');
    expect(breadcrumbLinks[2]).toHaveTextContent('label.create-entity');
  });

  it('should display SubTitle', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      await screen.findByText(/message.alerts-description/)
    ).toBeInTheDocument();
  });

  it('should render Add alert button', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findByText(/label.create-entity/)).toBeInTheDocument();
  });

  it('should navigate back when the cancel button is clicked', async () => {
    await act(async () => {
      render(<AddNotificationPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const cancelButton = screen.getByTestId('cancel-button');

    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
