/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
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
  },
};

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
      <div>{children}</div>
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

    // mockService.data.data.length + 1 because it has add service card as well
    expect(dataContainer.childElementCount).toBe(
      mockDatabaseService.data.data.length + 1
    );
  });

  it('On page load database service should be active tab with corresponding data', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });
    const tabs = await findAllByTestId(container, 'tab');
    const serviceNames = await findAllByTestId(container, 'service-name');

    expect(tabs[0]).toHaveClass('active');
    expect(serviceNames.map((s) => s.textContent)).toEqual(
      mockDatabaseService.data.data.map((d) => d.name)
    );
  });

  it('OnClick tab and data should change', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });
    let tabs = await findAllByTestId(container, 'tab');

    expect(tabs[0]).toHaveClass('active');

    fireEvent.click(tabs[1]);
    tabs = await findAllByTestId(container, 'tab');
    const serviceNames = await findAllByTestId(container, 'service-name');

    expect(tabs[1]).toHaveClass('active');
    expect(serviceNames.map((s) => s.textContent)).toEqual(
      mockMessagingService.data.data.map((d) => d.name)
    );
  });

  it('OnClick of add service, AddServiceModal should open', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });
    const addService = await findByTestId(container, 'add-services');
    fireEvent.click(addService);

    expect(
      await findByTestId(container, 'add-service-modal')
    ).toBeInTheDocument();
  });

  it('OnClick of edit service, AddServiceModal should open', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });
    const editService = await findAllByTestId(container, 'edit-service');
    fireEvent.click(editService[0]);

    expect(
      await findByTestId(container, 'add-service-modal')
    ).toBeInTheDocument();
  });

  it('Card details should be display properly', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });
    const serviceName = await findAllByTestId(container, 'service-name');
    const serviceDescription = await findAllByTestId(
      container,
      'service-description'
    );
    const additionalField = await findAllByTestId(
      container,
      'additional-field'
    );
    const ingestion = await findAllByTestId(container, 'service-ingestion');
    const type = await findAllByTestId(container, 'service-type');
    const edit = await findAllByTestId(container, 'edit-service');
    const deleteIcon = await findAllByTestId(container, 'delete-service');
    const icon = await findAllByTestId(container, 'service-icon');

    expect(serviceName.length).toBe(mockDatabaseService.data.data.length);
    expect(serviceDescription.length).toBe(
      mockDatabaseService.data.data.length
    );
    expect(additionalField.length).toBe(mockDatabaseService.data.data.length);
    expect(ingestion.length).toBe(mockDatabaseService.data.data.length);
    expect(type.length).toBe(mockDatabaseService.data.data.length);
    expect(edit.length).toBe(mockDatabaseService.data.data.length);
    expect(deleteIcon.length).toBe(mockDatabaseService.data.data.length);
    expect(icon.length).toBe(mockDatabaseService.data.data.length);
  });
});
