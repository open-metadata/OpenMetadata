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
import ConfigureService from './ConfigureService';
import { ConfigureServiceProps } from './Steps.interface';

const mockOnNext = jest.fn();
const mockOnBack = jest.fn();

const mockConfigureServiceProps: ConfigureServiceProps = {
  serviceName: 'testService',
  onBack: mockOnBack,
  onNext: mockOnNext,
};

describe('ConfigureService Component - Logo URL Field', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Logo URL Field Rendering', () => {
    it('should render logo URL field', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      expect(logoUrlField).toBeInTheDocument();
    });

    it('should have correct label for logo URL field', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlLabel = screen.getByText('label.service-logo-url');
      expect(logoUrlLabel).toBeInTheDocument();
    });

    it('should have correct placeholder for logo URL field', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      expect(logoUrlField).toHaveAttribute('placeholder', 'message.enter-service-logo-url');
    });

    it('should have help text for logo URL field', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const helpText = screen.getByText('message.service-logo-url-help');
      expect(helpText).toBeInTheDocument();
    });
  });

  describe('Logo URL Field Validation', () => {
    it('should accept valid HTTP URL', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      const serviceNameField = screen.getByTestId('service-name');
      const nextButton = screen.getByTestId('next-button');

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.change(logoUrlField, { target: { value: 'http://example.com/logo.png' } });
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'test-service',
        description: '',
        logoUrl: 'http://example.com/logo.png',
      });
    });

    it('should accept valid HTTPS URL', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      const serviceNameField = screen.getByTestId('service-name');
      const nextButton = screen.getByTestId('next-button');

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.change(logoUrlField, { target: { value: 'https://example.com/logo.svg' } });
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'test-service',
        description: '',
        logoUrl: 'https://example.com/logo.svg',
      });
    });

    it('should accept valid URL with subdomain', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      const serviceNameField = screen.getByTestId('service-name');
      const nextButton = screen.getByTestId('next-button');

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.change(logoUrlField, { target: { value: 'https://cdn.example.com/assets/logo.png' } });
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'test-service',
        description: '',
        logoUrl: 'https://cdn.example.com/assets/logo.png',
      });
    });

    it('should accept valid URL with query parameters', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      const serviceNameField = screen.getByTestId('service-name');
      const nextButton = screen.getByTestId('next-button');

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.change(logoUrlField, { target: { value: 'https://example.com/logo.png?v=1.0&size=64' } });
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'test-service',
        description: '',
        logoUrl: 'https://example.com/logo.png?v=1.0&size=64',
      });
    });

    it('should accept valid URL with port', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      const serviceNameField = screen.getByTestId('service-name');
      const nextButton = screen.getByTestId('next-button');

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.change(logoUrlField, { target: { value: 'https://example.com:8080/logo.png' } });
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'test-service',
        description: '',
        logoUrl: 'https://example.com:8080/logo.png',
      });
    });
  });

  describe('Logo URL Field Optional Behavior', () => {
    it('should allow empty logo URL field', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const serviceNameField = screen.getByTestId('service-name');
      const nextButton = screen.getByTestId('next-button');

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'test-service',
        description: '',
        logoUrl: '',
      });
    });

    it('should handle whitespace-only logo URL', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      const serviceNameField = screen.getByTestId('service-name');
      const nextButton = screen.getByTestId('next-button');

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.change(logoUrlField, { target: { value: '   ' } });
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'test-service',
        description: '',
        logoUrl: '   ',
      });
    });

    it('should not require logo URL field for form submission', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const serviceNameField = screen.getByTestId('service-name');
      const nextButton = screen.getByTestId('next-button');

      // Form should submit successfully without logo URL
      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'test-service',
        description: '',
        logoUrl: '',
      });
    });
  });

  describe('Form Integration', () => {
    it('should include logo URL in form submission with other fields', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const serviceNameField = screen.getByTestId('service-name');
      const logoUrlField = screen.getByTestId('logo-url');
      const nextButton = screen.getByTestId('next-button');

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'my-custom-service' } });
        fireEvent.change(logoUrlField, { target: { value: 'https://mycompany.com/logo.png' } });
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'my-custom-service',
        description: '',
        logoUrl: 'https://mycompany.com/logo.png',
      });
    });

    it('should preserve logo URL when going back and forth', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const serviceNameField = screen.getByTestId('service-name');
      const logoUrlField = screen.getByTestId('logo-url');

      // Fill in the form
      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.change(logoUrlField, { target: { value: 'https://example.com/logo.png' } });
      });

      // Verify values are preserved
      expect(serviceNameField).toHaveValue('test-service');
      expect(logoUrlField).toHaveValue('https://example.com/logo.png');

      // Go to next step
      const nextButton = screen.getByTestId('next-button');
      await act(async () => {
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'test-service',
        description: '',
        logoUrl: 'https://example.com/logo.png',
      });
    });
  });

  describe('User Experience', () => {
    it('should have proper input type for logo URL field', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      expect(logoUrlField).toHaveAttribute('type', 'text');
    });

    it('should be accessible with proper labels', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      const label = screen.getByText('label.service-logo-url');
      
      expect(logoUrlField).toBeInTheDocument();
      expect(label).toBeInTheDocument();
    });

    it('should show help text to guide users', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const helpText = screen.getByText('message.service-logo-url-help');
      expect(helpText).toBeInTheDocument();
    });

    it('should have appropriate placeholder text', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      expect(logoUrlField).toHaveAttribute('placeholder', 'message.enter-service-logo-url');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long URLs', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      const serviceNameField = screen.getByTestId('service-name');
      const nextButton = screen.getByTestId('next-button');

      const longUrl = 'https://example.com/very/long/path/to/logo/with/many/segments/and/parameters?param1=value1&param2=value2&param3=value3&param4=value4&param5=value5.png';

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.change(logoUrlField, { target: { value: longUrl } });
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'test-service',
        description: '',
        logoUrl: longUrl,
      });
    });

    it('should handle URLs with special characters', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      const serviceNameField = screen.getByTestId('service-name');
      const nextButton = screen.getByTestId('next-button');

      const specialCharUrl = 'https://example.com/logo%20with%20spaces.png';

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.change(logoUrlField, { target: { value: specialCharUrl } });
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'test-service',
        description: '',
        logoUrl: specialCharUrl,
      });
    });

    it('should handle international domain names', async () => {
      render(<ConfigureService {...mockConfigureServiceProps} />);

      const logoUrlField = screen.getByTestId('logo-url');
      const serviceNameField = screen.getByTestId('service-name');
      const nextButton = screen.getByTestId('next-button');

      const internationalUrl = 'https://例え.jp/logo.png';

      await act(async () => {
        fireEvent.change(serviceNameField, { target: { value: 'test-service' } });
        fireEvent.change(logoUrlField, { target: { value: internationalUrl } });
        fireEvent.click(nextButton);
      });

      expect(mockOnNext).toHaveBeenCalledWith({
        name: 'test-service',
        description: '',
        logoUrl: internationalUrl,
      });
    });
  });
});