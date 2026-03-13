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

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { BrowserRouter } from 'react-router-dom';
import AddServicePage from '../../../../../../pages/AddServicePage/AddServicePage.component';
import Services from '../../Services';
import { ServiceCategory } from '../../../../../../enums/service.enum';

// Mock all the dependencies
jest.mock('../../../../../../rest/serviceAPI', () => ({
  postService: jest.fn(),
  getServices: jest.fn(),
}));

jest.mock('../../../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: {
      DatabaseService: { Create: true, Delete: true, ViewAll: true },
    },
  }),
}));

jest.mock('../../../../../../context/AirflowStatusProvider/AirflowStatusProvider', () => ({
  useAirflowStatus: () => ({
    isFetchingStatus: false,
  }),
}));

jest.mock('../../../../../../hooks/paging/usePaging', () => ({
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
  useParams: () => ({ serviceCategory: 'databaseServices' }),
}));

import { postService, getServices } from '../../../../../../rest/serviceAPI';

const mockPostService = postService as jest.MockedFunction<typeof postService>;
const mockGetServices = getServices as jest.MockedFunction<typeof getServices>;

describe('Service Logo URL - End-to-End Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Service Creation Flow with Custom Logo', () => {
    it('should create service with custom logo and display it in service list', async () => {
      const customLogoUrl = 'https://example.com/my-custom-logo.png';
      const serviceName = 'my-custom-database';
      
      // Mock successful service creation
      const createdService = {
        id: '1',
        name: serviceName,
        displayName: 'My Custom Database',
        serviceType: 'CustomDatabase',
        fullyQualifiedName: serviceName,
        description: 'A custom database service',
        logoUrl: customLogoUrl,
        deleted: false,
        href: `/services/databaseServices/${serviceName}`,
      };

      mockPostService.mockResolvedValue(createdService);
      mockGetServices.mockResolvedValue({
        data: [createdService],
        paging: { total: 1, offset: 0, limit: 10 },
      });

      // Render the AddServicePage
      await act(async () => {
        render(
          <MemoryRouter>
            <AddServicePage />
          </MemoryRouter>
        );
      });

      // Wait for the page to load
      await waitFor(() => {
        expect(screen.getByTestId('add-new-service-container')).toBeInTheDocument();
      });

      // Fill in service configuration
      const serviceNameField = screen.getByTestId('service-name');
      const logoUrlField = screen.getByTestId('logo-url');
      const nextButton = screen.getByTestId('next-button');

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: serviceName } });
        fireEvent.change(logoUrlField, { target: { value: customLogoUrl } });
        fireEvent.click(nextButton);
      });

      // Verify the service was created with the custom logo
      expect(mockPostService).toHaveBeenCalledWith(
        ServiceCategory.DATABASE_SERVICES,
        expect.objectContaining({
          name: serviceName,
          logoUrl: customLogoUrl,
        })
      );

      // Now test that the service appears in the service list with the custom logo
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

      // Verify the custom logo is displayed
      const serviceIcon = screen.getByTestId('service-icon');
      const logoImg = serviceIcon.querySelector('img');
      expect(logoImg).toHaveAttribute('src', customLogoUrl);
    });

    it('should handle service creation without custom logo', async () => {
      const serviceName = 'my-standard-database';
      
      // Mock successful service creation without logo
      const createdService = {
        id: '1',
        name: serviceName,
        displayName: 'My Standard Database',
        serviceType: 'CustomDatabase',
        fullyQualifiedName: serviceName,
        description: 'A standard database service',
        logoUrl: null,
        deleted: false,
        href: `/services/databaseServices/${serviceName}`,
      };

      mockPostService.mockResolvedValue(createdService);
      mockGetServices.mockResolvedValue({
        data: [createdService],
        paging: { total: 1, offset: 0, limit: 10 },
      });

      // Render the AddServicePage
      await act(async () => {
        render(
          <MemoryRouter>
            <AddServicePage />
          </MemoryRouter>
        );
      });

      // Wait for the page to load
      await waitFor(() => {
        expect(screen.getByTestId('add-new-service-container')).toBeInTheDocument();
      });

      // Fill in service configuration without logo
      const serviceNameField = screen.getByTestId('service-name');
      const nextButton = screen.getByTestId('next-button');

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: serviceName } });
        fireEvent.click(nextButton);
      });

      // Verify the service was created without logo
      expect(mockPostService).toHaveBeenCalledWith(
        ServiceCategory.DATABASE_SERVICES,
        expect.objectContaining({
          name: serviceName,
          logoUrl: '',
        })
      );

      // Verify the service appears with default logo
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

      // Verify the default logo is displayed
      const serviceIcon = screen.getByTestId('service-icon');
      const logoImg = serviceIcon.querySelector('img');
      expect(logoImg).toHaveAttribute('src', expect.stringContaining('database'));
    });
  });

  describe('Multiple Service Types with Custom Logos', () => {
    const serviceTypeTestCases = [
      {
        category: ServiceCategory.DATABASE_SERVICES,
        serviceType: 'CustomDatabase',
        logoUrl: 'https://example.com/db-logo.png',
      },
      {
        category: ServiceCategory.PIPELINE_SERVICES,
        serviceType: 'CustomPipeline',
        logoUrl: 'https://example.com/pipeline-logo.svg',
      },
      {
        category: ServiceCategory.DASHBOARD_SERVICES,
        serviceType: 'CustomDashboard',
        logoUrl: 'https://example.com/dashboard-logo.png',
      },
    ];

    serviceTypeTestCases.forEach(({ category, serviceType, logoUrl }) => {
      it(`should handle ${serviceType} service with custom logo`, async () => {
        const serviceName = `test-${serviceType.toLowerCase()}`;
        
        const createdService = {
          id: '1',
          name: serviceName,
          displayName: `Test ${serviceType}`,
          serviceType,
          fullyQualifiedName: serviceName,
          description: `Test ${serviceType} service`,
          logoUrl,
          deleted: false,
          href: `/services/${category.toLowerCase()}/${serviceName}`,
        };

        mockPostService.mockResolvedValue(createdService);
        mockGetServices.mockResolvedValue({
          data: [createdService],
          paging: { total: 1, offset: 0, limit: 10 },
        });

        // Test service creation
        await act(async () => {
          render(
            <MemoryRouter>
              <AddServicePage />
            </MemoryRouter>
          );
        });

        await waitFor(() => {
          expect(screen.getByTestId('add-new-service-container')).toBeInTheDocument();
        });

        const serviceNameField = screen.getByTestId('service-name');
        const logoUrlField = screen.getByTestId('logo-url');
        const nextButton = screen.getByTestId('next-button');

        await act(async () => {
          fireEvent.change(serviceNameField, { target: { value: serviceName } });
          fireEvent.change(logoUrlField, { target: { value: logoUrl } });
          fireEvent.click(nextButton);
        });

        expect(mockPostService).toHaveBeenCalledWith(
          category,
          expect.objectContaining({
            name: serviceName,
            logoUrl,
          })
        );

        // Test service display
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
        expect(logoImg).toHaveAttribute('src', logoUrl);
      });
    });
  });

  describe('Error Handling in Complete Flow', () => {
    it('should handle service creation failure gracefully', async () => {
      const serviceName = 'failing-service';
      const logoUrl = 'https://example.com/logo.png';

      mockPostService.mockRejectedValue(new Error('Service creation failed'));

      await act(async () => {
        render(
          <MemoryRouter>
            <AddServicePage />
          </MemoryRouter>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-new-service-container')).toBeInTheDocument();
      });

      const serviceNameField = screen.getByTestId('service-name');
      const logoUrlField = screen.getByTestId('logo-url');
      const nextButton = screen.getByTestId('next-button');

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: serviceName } });
        fireEvent.change(logoUrlField, { target: { value: logoUrl } });
        fireEvent.click(nextButton);
      });

      // Should handle the error gracefully
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    it('should handle logo load failure in service list', async () => {
      const serviceName = 'broken-logo-service';
      const brokenLogoUrl = 'https://broken-url.com/logo.png';
      
      const serviceWithBrokenLogo = {
        id: '1',
        name: serviceName,
        displayName: 'Service with Broken Logo',
        serviceType: 'CustomDatabase',
        fullyQualifiedName: serviceName,
        description: 'Service with broken logo URL',
        logoUrl: brokenLogoUrl,
        deleted: false,
        href: `/services/databaseServices/${serviceName}`,
      };

      mockGetServices.mockResolvedValue({
        data: [serviceWithBrokenLogo],
        paging: { total: 1, offset: 0, limit: 10 },
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

      const serviceIcon = screen.getByTestId('service-icon');
      const logoImg = serviceIcon.querySelector('img') as HTMLImageElement;
      
      expect(logoImg).toHaveAttribute('src', brokenLogoUrl);

      // Simulate image load error
      const errorEvent = new Event('error');
      logoImg.dispatchEvent(errorEvent);

      // Should fallback to default logo
      await waitFor(() => {
        expect(logoImg.src).not.toBe(brokenLogoUrl);
        expect(logoImg.src).toContain('database');
      });
    });
  });

  describe('Form Validation Integration', () => {
    it('should validate logo URL format during service creation', async () => {
      await act(async () => {
        render(
          <MemoryRouter>
            <AddServicePage />
          </MemoryRouter>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-new-service-container')).toBeInTheDocument();
      });

      const serviceNameField = screen.getByTestId('service-name');
      const logoUrlField = screen.getByTestId('logo-url');
      const nextButton = screen.getByTestId('next-button');

      // Try to submit with invalid URL
      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.change(logoUrlField, { target: { value: 'not-a-valid-url' } });
        fireEvent.click(nextButton);
      });

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/invalid.*url/i)).toBeInTheDocument();
      });
    });

    it('should allow service creation with valid logo URL', async () => {
      const validLogoUrl = 'https://example.com/valid-logo.png';
      
      mockPostService.mockResolvedValue({
        id: '1',
        name: 'valid-service',
        logoUrl: validLogoUrl,
      });

      await act(async () => {
        render(
          <MemoryRouter>
            <AddServicePage />
          </MemoryRouter>
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('add-new-service-container')).toBeInTheDocument();
      });

      const serviceNameField = screen.getByTestId('service-name');
      const logoUrlField = screen.getByTestId('logo-url');
      const nextButton = screen.getByTestId('next-button');

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'valid-service' } });
        fireEvent.change(logoUrlField, { target: { value: validLogoUrl } });
        fireEvent.click(nextButton);
      });

      // Should proceed to next step without validation errors
      expect(mockPostService).toHaveBeenCalledWith(
        ServiceCategory.DATABASE_SERVICES,
        expect.objectContaining({
          name: 'valid-service',
          logoUrl: validLogoUrl,
        })
      );
    });
  });
});
