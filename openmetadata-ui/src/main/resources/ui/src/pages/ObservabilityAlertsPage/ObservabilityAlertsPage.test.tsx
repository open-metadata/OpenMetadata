/*
 *  Copyright 2022 Collate.
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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import LimitWrapper from '../../hoc/LimitWrapper';
import { getAllAlerts } from '../../rest/alertsAPI';
import ObservabilityAlertsPage from './ObservabilityAlertsPage';

const MOCK_DATA = [
  {
    id: '971a21b3-eeaf-4765-bda7-4e2cdb9788de',
    name: 'alert-test',
    fullyQualifiedName: 'alert-test',
    href: 'http://localhost:8585/api/v1/events/subscriptions/971a21b3-eeaf-4765-bda7-4e2cdb9788de',
    version: 0.1,
    updatedAt: 1682366749021,
    updatedBy: 'admin',
    filteringRules: {
      resources: ['all'],
      rules: [
        {
          name: 'matchIngestionPipelineState',
          effect: 'include',
          condition: "matchIngestionPipelineState('partialSuccess')",
        },
      ],
    },
    subscriptionType: 'Email',
    subscriptionConfig: {
      receivers: ['test@gmail.com'],
    },
    enabled: true,
    batchSize: 10,
    timeout: 10,
    readTimeout: 12,
    deleted: false,
    provider: 'user',
  },
];
const mockNavigate = jest.fn();
const mockLocationPathname = '/mock-path';
jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(
      ({ children, ...props }: { children: React.ReactNode }) => (
        <p {...props}>{children}</p>
      )
    ),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: mockLocationPathname,
  })),
}));

jest.mock('../../rest/alertsAPI', () => ({
  getAllAlerts: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: MOCK_DATA,
      paging: { total: 1 },
    })
  ),
}));

jest.mock('../../components/common/DeleteWidget/DeleteWidgetModal', () => {
  return jest
    .fn()
    .mockImplementation(({ visible }) =>
      visible ? <p>DeleteWidgetModal</p> : null
    );
});

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../hoc/LimitWrapper', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => <>LimitWrapper{children}</>);
});

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockReturnValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
    getResourcePermission: jest.fn().mockReturnValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
  }),
}));

describe('Observability Alerts Page Tests', () => {
  it('Title should be rendered', async () => {
    await act(async () => {
      render(<ObservabilityAlertsPage />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findByText('label.observability')).toBeInTheDocument();
  });

  it('SubTitle should be rendered', async () => {
    await act(async () => {
      render(<ObservabilityAlertsPage />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      await screen.findByText(/message.alerts-description/)
    ).toBeInTheDocument();
  });

  it('Add alert button should be rendered', async () => {
    await act(async () => {
      render(<ObservabilityAlertsPage />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findByText(/label.add-entity/)).toBeInTheDocument();
  });

  it('Table should render alerts data', async () => {
    await act(async () => {
      render(<ObservabilityAlertsPage />, {
        wrapper: MemoryRouter,
      });
    });

    const alertNameElement = await screen.findByText('alert-test');

    expect(alertNameElement).toBeInTheDocument();
  });

  it('Table should render no data', async () => {
    (getAllAlerts as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [],
        paging: { total: 1 },
      })
    );
    await act(async () => {
      render(<ObservabilityAlertsPage />, {
        wrapper: MemoryRouter,
      });
    });

    const alertNameElement = await screen.findByText(
      'message.adding-new-entity-is-easy-just-give-it-a-spin'
    );

    expect(alertNameElement).toBeInTheDocument();
  });

  it('should call LimitWrapper with resource as eventsubscription', async () => {
    await act(async () => {
      render(<ObservabilityAlertsPage />, {
        wrapper: MemoryRouter,
      });
    });

    expect(LimitWrapper).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'eventsubscription' }),
      {}
    );
  });

  it('should render edit and delete buttons for alerts with permissions', async () => {
    await act(async () => {
      render(<ObservabilityAlertsPage />, {
        wrapper: MemoryRouter,
      });
    });

    const editButton = await screen.findByTestId('alert-edit-alert-test');
    const deleteButton = await screen.findByTestId('alert-delete-alert-test');

    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });

  it('should open delete modal on delete button click', async () => {
    await act(async () => {
      render(<ObservabilityAlertsPage />, {
        wrapper: MemoryRouter,
      });
    });
    const deleteButton = await screen.findByTestId('alert-delete-alert-test');

    fireEvent.click(deleteButton);

    const deleteModal = await screen.findByText('DeleteWidgetModal');

    expect(deleteModal).toBeInTheDocument();
  });

  it('should navigate to add observability alert page on add button click', async () => {
    await act(async () => {
      render(<ObservabilityAlertsPage />, {
        wrapper: MemoryRouter,
      });
    });

    const addButton = await screen.findByText(/label.add-entity/);
    fireEvent.click(addButton);

    expect(mockNavigate).toHaveBeenCalledWith('/observability/alerts/add');
  });

  it('should not render add, edit and delete buttons for alerts without permissions', async () => {
    (usePermissionProvider as jest.Mock).mockImplementation(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementation(() => ({
        Create: false,
        Delete: false,
        ViewAll: true,
        EditAll: false,
        EditDescription: false,
        EditDisplayName: false,
        EditCustomFields: false,
      })),
      getResourcePermission: jest.fn().mockImplementation(() => ({
        Create: false,
        Delete: false,
        ViewAll: true,
        EditAll: false,
        EditDescription: false,
        EditDisplayName: false,
        EditCustomFields: false,
      })),
    }));

    await act(async () => {
      render(<ObservabilityAlertsPage />, {
        wrapper: MemoryRouter,
      });
    });

    const addButton = screen.queryByText(/label.add-entity/);
    const editButton = screen.queryByTestId('alert-edit-alert-test');
    const deleteButton = screen.queryByTestId('alert-delete-alert-test');

    expect(addButton).not.toBeInTheDocument();
    expect(editButton).not.toBeInTheDocument();
    expect(deleteButton).not.toBeInTheDocument();
  });
});
