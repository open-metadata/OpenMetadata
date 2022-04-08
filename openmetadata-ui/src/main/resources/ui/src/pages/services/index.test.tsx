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
  findByText,
  fireEvent,
  getByTestId,
  render,
} from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  deleteService,
  getServiceDetails,
  getServices,
  postService,
  updateService,
} from '../../axiosAPIs/serviceAPI';
import {
  mockCustomDashboardService,
  mockCustomMessagingService,
  mockDashboardService,
  mockDatabaseService,
  mockKafkaService,
  mockLookerService,
  mockMessagingService,
  mockMetabaseService,
  mockPipelineService,
  mockPowerBIService,
  mockPulsarService,
  mockRedashService,
  mockServiceDetails,
  mockSupersetService,
  mockTableauService,
} from '../../mocks/Service.mock';
import ServicesPage from './index';

jest.mock('../../authentication/auth-provider/AuthProvider', () => {
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
    const addService = await findByTestId(container, 'add-new-service-button');
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

describe('Test Messaging Service Cards', () => {
  it('Should render kafka service card with brokers', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });

    const tabs = await findAllByTestId(container, 'tab');

    fireEvent.click(tabs[1]);
    const dataContainer = await findByTestId(container, 'data-container');
    const serviceCards = await findAllByTestId(dataContainer, 'service-card');

    expect(serviceCards.length).toEqual(mockMessagingService.data.data.length);

    const kafkaServiceName = await findByText(
      serviceCards[0],
      mockKafkaService.name
    );
    const kafkaServiceBrokers = getByTestId(serviceCards[0], 'brokers');
    const kafkaServiceType = getByTestId(serviceCards[0], 'service-type');

    expect(kafkaServiceName).toBeInTheDocument();
    expect(kafkaServiceBrokers).toBeInTheDocument();
    expect(kafkaServiceBrokers).toHaveTextContent(
      mockKafkaService.connection.config.bootstrapServers
    );
    expect(kafkaServiceType).toBeInTheDocument();
    expect(kafkaServiceType).toHaveTextContent(
      `Type:${mockKafkaService.serviceType}`
    );
  });

  it('Should render pulsar service card without brokers', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });

    const tabs = await findAllByTestId(container, 'tab');

    fireEvent.click(tabs[1]);
    const dataContainer = await findByTestId(container, 'data-container');
    const serviceCards = await findAllByTestId(dataContainer, 'service-card');

    expect(serviceCards.length).toEqual(mockMessagingService.data.data.length);

    const pulsarServiceName = await findByText(
      serviceCards[1],
      mockPulsarService.name
    );
    const pulsarServiceBrokers = getByTestId(serviceCards[1], 'brokers');
    const pulsarServiceType = getByTestId(serviceCards[1], 'service-type');

    expect(pulsarServiceName).toBeInTheDocument();
    expect(pulsarServiceBrokers).toBeInTheDocument();
    expect(pulsarServiceBrokers).toHaveTextContent('--');
    expect(pulsarServiceType).toBeInTheDocument();
    expect(pulsarServiceType).toHaveTextContent(
      `Type:${mockPulsarService.serviceType}`
    );
  });

  it('Should render custom service card without brokers', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });

    const tabs = await findAllByTestId(container, 'tab');

    fireEvent.click(tabs[1]);
    const dataContainer = await findByTestId(container, 'data-container');
    const serviceCards = await findAllByTestId(dataContainer, 'service-card');

    expect(serviceCards.length).toEqual(mockMessagingService.data.data.length);

    const customServiceName = await findByText(
      serviceCards[2],
      mockCustomMessagingService.name
    );
    const customServiceBrokers = getByTestId(serviceCards[2], 'brokers');
    const customServiceType = getByTestId(serviceCards[2], 'service-type');

    expect(customServiceName).toBeInTheDocument();
    expect(customServiceBrokers).toBeInTheDocument();
    expect(customServiceBrokers).toHaveTextContent('--');
    expect(customServiceType).toBeInTheDocument();
    expect(customServiceType).toHaveTextContent(
      `Type:${mockCustomMessagingService.serviceType}`
    );
  });
});

describe('Test Dashboard Service Cards', () => {
  it('Should render looker service card with URL', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });

    const tabs = await findAllByTestId(container, 'tab');

    fireEvent.click(tabs[2]);
    const dataContainer = await findByTestId(container, 'data-container');
    const serviceCards = await findAllByTestId(dataContainer, 'service-card');

    expect(serviceCards.length).toEqual(mockDashboardService.data.data.length);

    const lookerCard = serviceCards[0];

    const lookerServiceName = await findByText(
      lookerCard,
      mockLookerService.name
    );
    const lookerServiceURL = getByTestId(lookerCard, 'dashboard-url');
    const lookerServiceType = getByTestId(lookerCard, 'service-type');

    expect(lookerServiceName).toBeInTheDocument();
    expect(lookerServiceURL).toBeInTheDocument();
    expect(lookerServiceURL).toHaveTextContent(
      mockLookerService.connection.config.url
    );
    expect(lookerServiceType).toBeInTheDocument();
    expect(lookerServiceType).toHaveTextContent(
      `Type:${mockLookerService.serviceType}`
    );
  });

  it('Should render metabase service card with URL', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });

    const tabs = await findAllByTestId(container, 'tab');

    fireEvent.click(tabs[2]);
    const dataContainer = await findByTestId(container, 'data-container');
    const serviceCards = await findAllByTestId(dataContainer, 'service-card');

    expect(serviceCards.length).toEqual(mockDashboardService.data.data.length);

    const metabaseCard = serviceCards[1];

    const metabaseServiceName = await findByText(
      metabaseCard,
      mockMetabaseService.name
    );
    const metabaseServiceURL = getByTestId(metabaseCard, 'dashboard-url');
    const metabaseServiceType = getByTestId(metabaseCard, 'service-type');

    expect(metabaseServiceName).toBeInTheDocument();
    expect(metabaseServiceURL).toBeInTheDocument();
    expect(metabaseServiceURL).toHaveTextContent(
      mockMetabaseService.connection.config.hostPort
    );
    expect(metabaseServiceType).toBeInTheDocument();
    expect(metabaseServiceType).toHaveTextContent(
      `Type:${mockMetabaseService.serviceType}`
    );
  });

  it('Should render powerbi service card with URL', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });

    const tabs = await findAllByTestId(container, 'tab');

    fireEvent.click(tabs[2]);
    const dataContainer = await findByTestId(container, 'data-container');
    const serviceCards = await findAllByTestId(dataContainer, 'service-card');

    expect(serviceCards.length).toEqual(mockDashboardService.data.data.length);

    const powerBICard = serviceCards[2];

    const powerBIServiceName = await findByText(
      powerBICard,
      mockPowerBIService.name
    );
    const powerBIServiceURL = getByTestId(powerBICard, 'dashboard-url');
    const powerBIServiceType = getByTestId(powerBICard, 'service-type');

    expect(powerBIServiceName).toBeInTheDocument();
    expect(powerBIServiceURL).toBeInTheDocument();
    expect(powerBIServiceURL).toHaveTextContent(
      mockPowerBIService.connection.config.dashboardURL
    );
    expect(powerBIServiceType).toBeInTheDocument();
    expect(powerBIServiceType).toHaveTextContent(
      `Type:${mockPowerBIService.serviceType}`
    );
  });

  it('Should render redash service card with URL', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });

    const tabs = await findAllByTestId(container, 'tab');

    fireEvent.click(tabs[2]);
    const dataContainer = await findByTestId(container, 'data-container');
    const serviceCards = await findAllByTestId(dataContainer, 'service-card');

    expect(serviceCards.length).toEqual(mockDashboardService.data.data.length);

    const redashCard = serviceCards[3];

    const redashServiceName = await findByText(
      redashCard,
      mockRedashService.name
    );
    const redashServiceURL = getByTestId(redashCard, 'dashboard-url');
    const redashServiceType = getByTestId(redashCard, 'service-type');

    expect(redashServiceName).toBeInTheDocument();
    expect(redashServiceURL).toBeInTheDocument();
    expect(redashServiceURL).toHaveTextContent(
      mockRedashService.connection.config.redashURL
    );
    expect(redashServiceType).toBeInTheDocument();
    expect(redashServiceType).toHaveTextContent(
      `Type:${mockRedashService.serviceType}`
    );
  });

  it('Should render superset service card with URL', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });

    const tabs = await findAllByTestId(container, 'tab');

    fireEvent.click(tabs[2]);
    const dataContainer = await findByTestId(container, 'data-container');
    const serviceCards = await findAllByTestId(dataContainer, 'service-card');

    expect(serviceCards.length).toEqual(mockDashboardService.data.data.length);

    const supersetCard = serviceCards[4];

    const supersetServiceName = await findByText(
      supersetCard,
      mockSupersetService.name
    );
    const supersetServiceURL = getByTestId(supersetCard, 'dashboard-url');
    const supersetServiceType = getByTestId(supersetCard, 'service-type');

    expect(supersetServiceName).toBeInTheDocument();
    expect(supersetServiceURL).toBeInTheDocument();
    expect(supersetServiceURL).toHaveTextContent(
      mockSupersetService.connection.config.supersetURL
    );
    expect(supersetServiceType).toBeInTheDocument();
    expect(supersetServiceType).toHaveTextContent(
      `Type:${mockSupersetService.serviceType}`
    );
  });

  it('Should render tableau service card with URL', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });

    const tabs = await findAllByTestId(container, 'tab');

    fireEvent.click(tabs[2]);
    const dataContainer = await findByTestId(container, 'data-container');
    const serviceCards = await findAllByTestId(dataContainer, 'service-card');

    expect(serviceCards.length).toEqual(mockDashboardService.data.data.length);

    const tableauCard = serviceCards[5];

    const tableauServiceName = await findByText(
      tableauCard,
      mockTableauService.name
    );
    const tableauServiceURL = getByTestId(tableauCard, 'dashboard-url');
    const tableauServiceType = getByTestId(tableauCard, 'service-type');

    expect(tableauServiceName).toBeInTheDocument();
    expect(tableauServiceURL).toBeInTheDocument();
    expect(tableauServiceURL).toHaveTextContent(
      mockTableauService.connection.config.siteURL
    );
    expect(tableauServiceType).toBeInTheDocument();
    expect(tableauServiceType).toHaveTextContent(
      `Type:${mockTableauService.serviceType}`
    );
  });

  it('Should render custom service card without URL', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });

    const tabs = await findAllByTestId(container, 'tab');

    fireEvent.click(tabs[2]);
    const dataContainer = await findByTestId(container, 'data-container');
    const serviceCards = await findAllByTestId(dataContainer, 'service-card');

    expect(serviceCards.length).toEqual(mockDashboardService.data.data.length);

    const customCard = serviceCards[6];

    const customServiceName = await findByText(
      customCard,
      mockCustomDashboardService.name
    );
    const customServiceURL = getByTestId(customCard, 'dashboard-url');
    const customServiceType = getByTestId(customCard, 'service-type');

    expect(customServiceName).toBeInTheDocument();
    expect(customServiceURL).toBeInTheDocument();
    expect(customServiceURL).toHaveTextContent('--');
    expect(customServiceType).toBeInTheDocument();
    expect(customServiceType).toHaveTextContent(
      `Type:${mockCustomDashboardService.serviceType}`
    );
  });
});

describe('Test Service Page Error Handling', () => {
  it('Should render error placholder if getServiceDetails API fails', async () => {
    (getServiceDetails as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({ response: { data: { message: 'Error' } } })
    );
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });

    const errorPlaceholder = await findByTestId(container, 'error');

    expect(errorPlaceholder).toBeInTheDocument();
  });

  it('Should render page if updateService API fails', async () => {
    (updateService as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({ response: { data: { message: 'Error' } } })
    );
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

  it('Should render services-container if getServices API fails', async () => {
    (getServices as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({ response: { data: { message: 'Error' } } })
    );
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });

    const services = await findByTestId(container, 'services-container');

    expect(services).toBeInTheDocument();
  });

  it('Should render page if postService API fails', async () => {
    (postService as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({ response: { data: { message: 'UnExpected Response' } } })
    );
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

  it('Should render page if deleteService API fails', async () => {
    (deleteService as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({ response: { data: { message: 'UnExpected Response' } } })
    );
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
});
