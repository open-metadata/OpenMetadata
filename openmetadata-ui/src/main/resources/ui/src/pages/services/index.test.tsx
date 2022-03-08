/*
 *  Copyright 2021 Collate
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
  findAllByTestId,
  findByTestId,
  fireEvent,
  render,
} from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import ServicesPage from './index';

const mockServiceDetails = {
  data: [
    {
      collection: {
        documentation: 'Messaging service collection',
        href: 'http://messagingServices',
        name: 'messagingServices',
      },
    },
    {
      collection: {
        documentation: 'Database service collection',
        href: 'http://databaseServices',
        name: 'databaseServices',
      },
    },
    {
      collection: {
        documentation: 'Dashboard service collection',
        href: 'http://dashboardServices',
        name: 'dashboardServices',
      },
    },
    {
      collection: {
        name: 'pipelineServices',
        documentation: 'Pipeline service collection',
        href: 'http://pipelineServices',
      },
    },
  ],
};

const mockDatabaseService = {
  data: {
    data: [
      {
        id: '847deda6-5342-42ed-b392-f0178a502c13',
        name: 'bigquery',
        serviceType: 'BigQuery',
        description: 'BigQuery service used for shopify data',
        href: 'http://localhost:8585/api/v1/services/databaseServices/847deda6-5342-42ed-b392-f0178a502c13',
        jdbc: {
          driverClass: 'jdbc',
          connectionUrl: 'jdbc://localhost',
        },
      },
      {
        id: '847deda6-5342-42ed-b392-f0178a502c13',
        name: 'mysql',
        serviceType: 'MySql',
        description: 'MySql service used for shopify data',
        href: 'http://localhost:8585/api/v1/services/databaseServices/847deda6-5342-42ed-b392-f0178a502c13',
        jdbc: {
          driverClass: 'jdbc',
          connectionUrl: 'jdbc://localhost',
        },
      },
    ],
    paging: { total: 2 },
  },
};

const mockMessagingService = {
  data: {
    data: [
      {
        brokers: ['localhost:9092'],
        description: 'Kafka messaging queue service',
        href: 'http://localhost:8585/api/v1/services/messagingServices/473e2a9b-7555-42d3-904a-4c773c4dcd33',
        id: '473e2a9b-7555-42d3-904a-4c773c4dcd33',
        name: 'sample_kafka',
        schemaRegistry: 'http://localhost:8081',
        serviceType: 'Kafka',
      },
    ],
    paging: { total: 1 },
  },
};

const mockDashboardService = {
  data: {
    data: [
      {
        dashboardUrl: 'http://localhost:8088',
        description: 'Supset Service',
        href: 'http://localhost:8585/api/v1/services/dashboardServices/627a0545-39bc-47d1-bde8-df8bf19b4616',
        id: '627a0545-39bc-47d1-bde8-df8bf19b4616',
        name: 'sample_superset',
        password: 'admin',
        serviceType: 'Superset',
        username: 'admin',
      },
    ],
    paging: { total: 1 },
  },
};

const mockPipelineService = {
  data: {
    data: [
      {
        id: '7576944e-2921-4c15-9edc-b9bada93338a',
        name: 'sample_airflow',
        serviceType: 'Airflow',
        description: 'Airflow service',
        version: 0.1,
        pipelineUrl: 'http://localhost:8080',
        href: 'http://localhost:8585/api/v1/services/pipelineServices/7576944e-2921-4c15-9edc-b9bada93338a',
      },
    ],
    paging: { total: 1 },
  },
};

jest.mock('../../auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

jest.mock('../../axiosAPIs/serviceAPI', () => ({
  deleteService: jest.fn(),
  getServiceDetails: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockServiceDetails })),
  getServices: jest.fn().mockImplementation((type) => {
    switch (type) {
      case 'databaseServices':
        return Promise.resolve(mockDatabaseService);

      case 'messagingServices':
        return Promise.resolve(mockMessagingService);

      case 'pipelineServices':
        return Promise.resolve(mockPipelineService);

      default:
        return Promise.resolve(mockDashboardService);
    }
  }),
  postService: jest.fn(),
  updateService: jest.fn(),
}));

jest.mock(
  '../../components/common/rich-text-editor/RichTextEditorPreviewer',
  () => {
    return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
  }
);

jest.mock('../../components/common/non-admin-action/NonAdminAction', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <span>{children}</span>
    ));
});

jest.mock('../../components/Modals/AddServiceModal/AddServiceModal', () => ({
  AddServiceModal: jest
    .fn()
    .mockReturnValue(<p data-testid="add-service-modal">AddServiceModal</p>),
}));

describe('Test Service page', () => {
  it('Check if there is an element in the page', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });
    const services = await findByTestId(container, 'services-container');
    const tabs = await findAllByTestId(container, 'tab');
    const dataContainer = await findByTestId(container, 'data-container');

    expect(services).toBeInTheDocument();
    expect(tabs.length).toBe(mockServiceDetails.data.length);
    expect(dataContainer).toBeInTheDocument();
  });

  it('On page load database service should be active tab with corresponding data', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });
    const tabs = await findAllByTestId(container, 'tab');
    const serviceNames = await findByTestId(container, 'service-name');
    const dataContainer = await findByTestId(container, 'data-container');

    expect(tabs[0]).toHaveClass('activeCategory');
    expect(serviceNames).toBeInTheDocument();
    expect(dataContainer.childElementCount).toBe(
      mockDatabaseService.data.data.length
    );
  });

  it('OnClick tab and data should change', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });
    let tabs = await findAllByTestId(container, 'tab');

    expect(tabs[0]).toHaveClass('activeCategory');

    fireEvent.click(tabs[1]);
    tabs = await findAllByTestId(container, 'tab');
    const dataContainer = await findByTestId(container, 'data-container');

    expect(tabs[1]).toHaveClass('activeCategory');
    expect(dataContainer.childElementCount).toBe(
      mockMessagingService.data.data.length
    );
  });

  it('OnClick of add service, AddServiceModal should open', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });
    const addService = await findByTestId(container, 'add-new-user-button');
    fireEvent.click(addService);

    expect(
      await findByTestId(container, 'add-service-modal')
    ).toBeInTheDocument();
  });

  it('Card details should be display properly', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });
    const serviceName = await findByTestId(container, 'service-name');
    const tabs = await findAllByTestId(container, 'tab');

    const serviceDescription = await findAllByTestId(
      container,
      'service-description'
    );
    const type = await findAllByTestId(container, 'service-type');
    const deleteIcon = await findAllByTestId(
      container,
      'delete-icon-container'
    );
    const icon = await findAllByTestId(container, 'service-icon');

    expect(tabs[0]).toHaveClass('activeCategory');
    expect(tabs[0].innerText).toBe(serviceName.innerText);
    expect(serviceDescription.length).toBe(
      mockDatabaseService.data.data.length
    );
    expect(type.length).toBe(mockDatabaseService.data.data.length);
    expect(deleteIcon.length).toBe(mockDatabaseService.data.data.length);
    expect(icon.length).toBe(mockDatabaseService.data.data.length);
  });
});
