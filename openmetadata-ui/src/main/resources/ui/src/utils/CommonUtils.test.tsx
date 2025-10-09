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
import { getServiceLogo } from './CommonUtils';

// Mock the ServiceUtilClassBase
jest.mock('./ServiceUtilClassBase', () => ({
  getServiceTypeLogo: jest.fn(),
}));

import serviceUtilClassBase from './ServiceUtilClassBase';

const mockGetServiceTypeLogo = serviceUtilClassBase.getServiceTypeLogo as jest.MockedFunction<
  typeof serviceUtilClassBase.getServiceTypeLogo
>;

describe('CommonUtils - getServiceLogo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServiceTypeLogo.mockReturnValue('default-logo.png');
  });

  describe('Custom logo URL handling', () => {
    it('should render custom logo when logoUrl is provided', () => {
      const serviceEntity = {
        logoUrl: 'https://example.com/custom-logo.png',
        serviceType: 'CustomDatabase',
      };

      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class', serviceEntity)
      );

      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/custom-logo.png');
      expect(img).toHaveClass('test-class');
    });

    it('should render custom logo with default className when not provided', () => {
      const serviceEntity = {
        logoUrl: 'https://example.com/custom-logo.png',
        serviceType: 'CustomDatabase',
      };

      const { container } = render(
        getServiceLogo('CustomDatabase', '', serviceEntity)
      );

      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/custom-logo.png');
      expect(img).toHaveClass('');
    });

    it('should render custom logo with SVG format', () => {
      const serviceEntity = {
        logoUrl: 'https://example.com/custom-logo.svg',
        serviceType: 'CustomPipeline',
      };

      const { container } = render(
        getServiceLogo('CustomPipeline', 'w-4 h-4', serviceEntity)
      );

      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/custom-logo.svg');
      expect(img).toHaveClass('w-4 h-4');
    });
  });

  describe('Fallback to default logo', () => {
    it('should use default logo when no custom logoUrl provided', () => {
      const serviceEntity = {
        serviceType: 'CustomDatabase',
      };

      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class', serviceEntity)
      );

      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'default-logo.png');
      expect(mockGetServiceTypeLogo).toHaveBeenCalledWith({
        serviceType: 'CustomDatabase',
      });
    });

    it('should use default logo when serviceEntity is not provided', () => {
      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class')
      );

      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'default-logo.png');
      expect(mockGetServiceTypeLogo).toHaveBeenCalledWith({
        serviceType: 'CustomDatabase',
      });
    });

    it('should use default logo when serviceEntity is empty', () => {
      const serviceEntity = {};

      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class', serviceEntity)
      );

      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'default-logo.png');
    });
  });

  describe('Error handling and fallback', () => {
    it('should fallback to default logo when custom logo fails to load', async () => {
      const serviceEntity = {
        logoUrl: 'https://example.com/broken-logo.png',
        serviceType: 'CustomDatabase',
      };

      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class', serviceEntity)
      );

      const img = container.querySelector('img') as HTMLImageElement;
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/broken-logo.png');

      // Simulate image load error
      fireEvent.error(img);

      await waitFor(() => {
        expect(img).toHaveAttribute('src', 'default-logo.png');
      });

      expect(mockGetServiceTypeLogo).toHaveBeenCalledWith({
        serviceType: 'CustomDatabase',
      });
    });

    it('should handle multiple error events gracefully', async () => {
      const serviceEntity = {
        logoUrl: 'https://example.com/broken-logo.png',
        serviceType: 'CustomDatabase',
      };

      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class', serviceEntity)
      );

      const img = container.querySelector('img') as HTMLImageElement;
      
      // Simulate multiple error events
      fireEvent.error(img);
      fireEvent.error(img);
      fireEvent.error(img);

      await waitFor(() => {
        expect(img).toHaveAttribute('src', 'default-logo.png');
      });

      // Should only call getServiceTypeLogo once per error event
      expect(mockGetServiceTypeLogo).toHaveBeenCalledTimes(3);
    });

    it('should not fallback if custom logo loads successfully', async () => {
      const serviceEntity = {
        logoUrl: 'https://example.com/working-logo.png',
        serviceType: 'CustomDatabase',
      };

      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class', serviceEntity)
      );

      const img = container.querySelector('img') as HTMLImageElement;
      expect(img).toHaveAttribute('src', 'https://example.com/working-logo.png');

      // Simulate successful image load
      fireEvent.load(img);

      await waitFor(() => {
        expect(img).toHaveAttribute('src', 'https://example.com/working-logo.png');
      });

      // Should not call getServiceTypeLogo for fallback
      expect(mockGetServiceTypeLogo).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle null logoUrl', () => {
      const serviceEntity = {
        logoUrl: null,
        serviceType: 'CustomDatabase',
      };

      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class', serviceEntity)
      );

      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'default-logo.png');
    });

    it('should handle undefined logoUrl', () => {
      const serviceEntity = {
        logoUrl: undefined,
        serviceType: 'CustomDatabase',
      };

      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class', serviceEntity)
      );

      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'default-logo.png');
    });

    it('should handle empty string logoUrl', () => {
      const serviceEntity = {
        logoUrl: '',
        serviceType: 'CustomDatabase',
      };

      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class', serviceEntity)
      );

      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'default-logo.png');
    });

    it('should handle whitespace-only logoUrl', () => {
      const serviceEntity = {
        logoUrl: '   ',
        serviceType: 'CustomDatabase',
      };

      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class', serviceEntity)
      );

      const img = container.querySelector('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'default-logo.png');
    });

    it('should return null when no logo is available', () => {
      mockGetServiceTypeLogo.mockReturnValue(null);

      const result = getServiceLogo('UnknownService', 'test-class');

      expect(result).toBeNull();
    });

    it('should return null when getServiceTypeLogo returns empty string', () => {
      mockGetServiceTypeLogo.mockReturnValue('');

      const result = getServiceLogo('UnknownService', 'test-class');

      expect(result).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should have proper alt attribute', () => {
      const serviceEntity = {
        logoUrl: 'https://example.com/custom-logo.png',
        serviceType: 'CustomDatabase',
      };

      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class', serviceEntity)
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('alt', '');
    });

    it('should have proper alt attribute for default logo', () => {
      const { container } = render(
        getServiceLogo('CustomDatabase', 'test-class')
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('alt', '');
    });
  });

  describe('Different service types', () => {
    const serviceTypeTestCases = [
      'CustomDatabase',
      'CustomPipeline',
      'CustomDashboard',
      'CustomMessaging',
      'CustomMlModel',
      'CustomStorage',
      'CustomSearch',
      'CustomDrive',
      'CustomApi',
      'CustomSecurity',
      'CustomMetadata',
    ];

    serviceTypeTestCases.forEach((serviceType) => {
      it(`should handle ${serviceType} with custom logo`, () => {
        const serviceEntity = {
          logoUrl: `https://example.com/${serviceType.toLowerCase()}-logo.png`,
          serviceType,
        };

        const { container } = render(
          getServiceLogo(serviceType, 'test-class', serviceEntity)
        );

        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', `https://example.com/${serviceType.toLowerCase()}-logo.png`);
      });

      it(`should handle ${serviceType} without custom logo`, () => {
        const serviceEntity = { serviceType };

        const { container } = render(
          getServiceLogo(serviceType, 'test-class', serviceEntity)
        );

        const img = container.querySelector('img');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'default-logo.png');
        expect(mockGetServiceTypeLogo).toHaveBeenCalledWith({ serviceType });
      });
    });
  });
});
