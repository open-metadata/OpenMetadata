/*
 *  Copyright 2025 Collate
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
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-dom/test-utils';
import Services from './Services';
import { ServiceCategory } from '../../../../enums/service.enum';

// Mock the dependencies
jest.mock('../../../../rest/serviceAPI', () => ({
  getServices: jest.fn(),
  searchService: jest.fn(),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: {
      DatabaseService: { Create: true, Delete: true, ViewAll: true },
      PipelineService: { Create: true, Delete: true, ViewAll: true },
      DashboardService: { Create: true, Delete: true, ViewAll: true },
    },
  }),
}));

jest.mock('../../../../context/AirflowStatusProvider/AirflowStatusProvider', () => ({
  useAirflowStatus: () => ({
    isFetchingStatus: false,
  }),
}));

jest.mock('../../../../hooks/paging/usePaging', () => ({
  usePaging: () => ({
    paging: { total: 0, offset: 0, limit: 10 },
    handlePagingChange: jest.fn(),
    currentPage: 1,
    handlePageChange: jest.fn(),
    pageSize: 10,
    handlePageSizeChange: jest.fn(),
    showPagination: false,
  }),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

import { getServices, searchService } from '../../../../rest/serviceAPI';

const mockGetServices = getServices as jest.MockedFunction<typeof getServices>;
const mockSearchService = searchService as jest.MockedFunction<typeof searchService>;

describe('Services Component - Logo Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockServices = [
    {
      id: '1',
      name: 'custom-db-1',
      displayName: 'Custom Database 1',
      serviceType: 'CustomDatabase',
      fullyQualifiedName: 'custom-db-1',
      description: 'Test custom database',
      logoUrl: 'https://example.com/custom-db-logo.png',
      deleted: false,
      href: '/services/databaseServices/custom-db-1',
    },
    {
      id: '2',
      name: 'custom-pipeline-1',
      displayName: 'Custom Pipeline 1',
      serviceType: 'CustomPipeline',
      fullyQualifiedName: 'custom-pipeline-1',
      description: 'Test custom pipeline',
      logoUrl: 'https://example.com/custom-pipeline-logo.svg',
      deleted: false,
      href: '/services/pipelineServices/custom-pipeline-1',
    },
    {
      id: '3',
      name: 'custom-dashboard-1',
      displayName: 'Custom Dashboard 1',
      serviceType: 'CustomDashboard',
      fullyQualifiedName: 'custom-dashboard-1',
      description: 'Test custom dashboard',
      logoUrl: null, // No custom logo
      deleted: false,
      href: '/services/dashboardServices/custom-dashboard-1',
    },
    {
      id: '4',
      name: 'mysql-service',
      displayName: 'MySQL Service',
      serviceType: 'Mysql',
      fullyQualifiedName: 'mysql-service',
      description: 'Standard MySQL service',
      logoUrl: undefined, // No custom logo
      deleted: false,
      href: '/services/databaseServices/mysql-service',
    },
  ];

  describe('Service List View', () => {
    it('should display custom logos in service list', async () => {
      mockGetServices.mockResolvedValue({
        data: mockServices,
        paging: { total: 4, offset: 0, limit: 10 },
      });

      await act(async () => {
        render(
          <MemoryRouter>
            <Services serviceName={ServiceCategory.DATABASE_SERVICES} />
          </MemoryRouter>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('services-container')).toBeInTheDocument();
      });

      // Check that custom logos are displayed
      const customDbLogo = screen.getByTestId('service-name-custom-db-1')
        .closest('div')
        ?.querySelector('img');
      expect(customDbLogo).toHaveAttribute('src', 'https://example.com/custom-db-logo.png');

      const customPipelineLogo = screen.getByTestId('service-name-custom-pipeline-1')
        .closest('div')
        ?.querySelector('img');
      expect(customPipelineLogo).toHaveAttribute('src', 'https://example.com/custom-pipeline-logo.svg');
    });

    it('should fallback to default logos when no custom logo provided', async () => {
      mockGetServices.mockResolvedValue({
        data: mockServices,
        paging: { total: 4, offset: 0, limit: 10 },
      });

      await act(async () => {
        render(
          <MemoryRouter>
            <Services serviceName={ServiceCategory.DATABASE_SERVICES} />
          </MemoryRouter>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('services-container')).toBeInTheDocument();
      });

      // Check that default logos are used for services without custom logos
      const defaultDashboardLogo = screen.getByTestId('service-name-custom-dashboard-1')
        .closest('div')
        ?.querySelector('img');
      expect(defaultDashboardLogo).toHaveAttribute('src', expect.stringContaining('dashboard'));

      const defaultMysqlLogo = screen.getByTestId('service-name-mysql-service')
        .closest('div')
        ?.querySelector('img');
      expect(defaultMysqlLogo).toHaveAttribute('src', expect.stringContaining('mysql'));
    });

    it('should handle logo load errors gracefully', async () => {
      mockGetServices.mockResolvedValue({
        data: mockServices,
        paging: { total: 4, offset: 0, limit: 10 },
      });

      await act(async () => {
        render(
          <MemoryRouter>
            <Services serviceName={ServiceCategory.DATABASE_SERVICES} />
          </MemoryRouter>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('services-container')).toBeInTheDocument();
      });

      // Find the custom logo image
      const customLogo = screen.getByTestId('service-name-custom-db-1')
        .closest('div')
        ?.querySelector('img') as HTMLImageElement;

      expect(customLogo).toHaveAttribute('src', 'https://example.com/custom-db-logo.png');

      // Simulate image load error
      const errorEvent = new Event('error');
      customLogo.dispatchEvent(errorEvent);

      // Should fallback to default logo
      await waitFor(() => {
        expect(customLogo.src).not.toBe('https://example.com/custom-db-logo.png');
      });
    });
  });

  describe('Service Card View', () => {
    it('should display custom logos in service cards', async () => {
      mockGetServices.mockResolvedValue({
        data: mockServices,
        paging: { total: 4, offset: 0, limit: 10 },
      });

      await act(async () => {
        render(
          <MemoryRouter>
            <Services serviceName={ServiceCategory.DATABASE_SERVICES} />
          </MemoryRouter>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('services-container')).toBeInTheDocument();
      });

      // Check service card icons
      const serviceIcons = screen.getAllByTestId('service-icon');
      expect(serviceIcons).toHaveLength(4);

      // First service should have custom logo
      const firstServiceIcon = serviceIcons[0].querySelector('img');
      expect(firstServiceIcon).toHaveAttribute('src', 'https://example.com/custom-db-logo.png');
    });

    it('should handle different service categories with custom logos', async () => {
      const pipelineServices = mockServices.filter(s => s.serviceType === 'CustomPipeline');
      
      mockGetServices.mockResolvedValue({
        data: pipelineServices,
        paging: { total: 1, offset: 0, limit: 10 },
      });

      await act(async () => {
        render(
          <MemoryRouter>
            <Services serviceName={ServiceCategory.PIPELINE_SERVICES} />
          </MemoryRouter>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('services-container')).toBeInTheDocument();
      });

      const serviceIcon = screen.getByTestId('service-icon');
      const logoImg = serviceIcon.querySelector('img');
      expect(logoImg).toHaveAttribute('src', 'https://example.com/custom-pipeline-logo.svg');
    });
  });

  describe('Search and Filter', () => {
    it('should maintain custom logos during search', async () => {
      mockSearchService.mockResolvedValue({
        hits: {
          total: {
            value: 1,
          },
          hits: [
            {
              _source: mockServices[0],
            },
          ],
        },
      });

      await act(async () => {
        render(
          <MemoryRouter>
            <Services serviceName={ServiceCategory.DATABASE_SERVICES} />
          </MemoryRouter>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('services-container')).toBeInTheDocument();
      });

      // Perform search
      const searchInput = screen.getByPlaceholderText(/search/i);
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: 'custom' } });
      });

      await waitFor(() => {
        expect(mockSearchService).toHaveBeenCalled();
      });

      // Custom logo should still be displayed
      const customLogo = screen.getByTestId('service-name-custom-db-1')
        .closest('div')
        ?.querySelector('img');
      expect(customLogo).toHaveAttribute('src', 'https://example.com/custom-db-logo.png');
    });
  });

  describe('Different Service Types', () => {
    const serviceTypeTestCases = [
      { category: ServiceCategory.DATABASE_SERVICES, serviceType: 'CustomDatabase' },
      { category: ServiceCategory.PIPELINE_SERVICES, serviceType: 'CustomPipeline' },
      { category: ServiceCategory.DASHBOARD_SERVICES, serviceType: 'CustomDashboard' },
      { category: ServiceCategory.MESSAGING_SERVICES, serviceType: 'CustomMessaging' },
      { category: ServiceCategory.MLMODEL_SERVICES, serviceType: 'CustomMlModel' },
      { category: ServiceCategory.STORAGE_SERVICES, serviceType: 'CustomStorage' },
      { category: ServiceCategory.SEARCH_SERVICES, serviceType: 'CustomSearch' },
      { category: ServiceCategory.DRIVE_SERVICES, serviceType: 'CustomDrive' },
    ];

    serviceTypeTestCases.forEach(({ category, serviceType }) => {
      it(`should handle custom logos for ${serviceType} services`, async () => {
        const testService = {
          id: '1',
          name: `test-${serviceType.toLowerCase()}`,
          displayName: `Test ${serviceType}`,
          serviceType,
          fullyQualifiedName: `test-${serviceType.toLowerCase()}`,
          description: `Test ${serviceType} service`,
          logoUrl: `https://example.com/${serviceType.toLowerCase()}-logo.png`,
          deleted: false,
          href: `/services/${category.toLowerCase()}/test-${serviceType.toLowerCase()}`,
        };

        mockGetServices.mockResolvedValue({
          data: [testService],
          paging: { total: 1, offset: 0, limit: 10 },
        });

        await act(async () => {
          render(
            <MemoryRouter>
              <Services serviceName={category} />
            </MemoryRouter>
          );
        });

        await waitFor(() => {
          expect(screen.getByTestId('services-container')).toBeInTheDocument();
        });

        const serviceIcon = screen.getByTestId('service-icon');
        const logoImg = serviceIcon.querySelector('img');
        expect(logoImg).toHaveAttribute('src', `https://example.com/${serviceType.toLowerCase()}-logo.png`);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service fetch errors gracefully', async () => {
      mockGetServices.mockRejectedValue(new Error('Failed to fetch services'));

      await act(async () => {
        render(
          <MemoryRouter>
            <Services serviceName={ServiceCategory.DATABASE_SERVICES} />
          </MemoryRouter>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
      });
    });

    it('should handle empty service list', async () => {
      mockGetServices.mockResolvedValue({
        data: [],
        paging: { total: 0, offset: 0, limit: 10 },
      });

      await act(async () => {
        render(
          <MemoryRouter>
            <Services serviceName={ServiceCategory.DATABASE_SERVICES} />
          </MemoryRouter>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('services-container')).toBeInTheDocument();
      });

      expect(screen.getByText(/no services found/i)).toBeInTheDocument();
    });
  });
});