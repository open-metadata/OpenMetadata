/*
 *  Copyright 2025 Collate.
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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProviderSelector from './ProviderSelector';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../utils/SSOUtils', () => ({
  PROVIDER_OPTIONS: [
    {
      key: 'google',
      label: 'Google',
      icon: '/icon-google.png',
    },
    {
      key: 'azure',
      label: 'Azure AD',
      icon: '/icon-azure.png',
    },
    {
      key: 'okta',
      label: 'Okta',
      icon: '/icon-okta.png',
    },
    {
      key: 'saml',
      label: 'SAML',
      icon: '/icon-saml.png',
    },
    {
      key: 'awsCognito',
      label: 'AWS-Cognito',
      icon: '/icon-cognito.png',
    },
    {
      key: 'customOidc',
      label: 'Custom-OIDC',
      icon: '/icon-oidc.png',
    },
    {
      key: 'ldap',
      label: 'LDAP',
      icon: '/icon-ldap.png',
    },
    {
      key: 'auth0',
      label: 'Auth0',
      icon: '/icon-auth0.png',
    },
  ],
  getProviderDisplayName: (provider: string) => {
    const names: Record<string, string> = {
      google: 'Google',
      okta: 'Okta',
      azure: 'Azure AD',
      auth0: 'Auth0',
      customOidc: 'Custom OIDC',
      saml: 'SAML',
    };

    return names[provider] || provider;
  },
  getProviderIcon: (provider: string) => {
    return `/icon-${provider}.png`;
  },
}));

describe('ProviderSelector', () => {
  const mockOnProviderSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render provider selector title', () => {
      render(<ProviderSelector onProviderSelect={mockOnProviderSelect} />);

      expect(screen.getByText('label.choose-provider')).toBeInTheDocument();
    });

    it('should render all available SSO providers', () => {
      render(<ProviderSelector onProviderSelect={mockOnProviderSelect} />);

      // Check for providers

      expect(screen.getByText('Google')).toBeInTheDocument();

      expect(screen.getByText('Okta')).toBeInTheDocument();

      expect(screen.getByText('Azure AD')).toBeInTheDocument();

      expect(screen.getByText('Auth0')).toBeInTheDocument();

      expect(screen.getByText('Custom-OIDC')).toBeInTheDocument();

      expect(screen.getByText('SAML')).toBeInTheDocument();

      expect(screen.getByText('AWS-Cognito')).toBeInTheDocument();

      expect(screen.getByText('LDAP')).toBeInTheDocument();
    });

    it('should render providers in a flex container', () => {
      const { container } = render(
        <ProviderSelector onProviderSelect={mockOnProviderSelect} />
      );

      const flexContainer = container.querySelector(
        '.provider-selection-container'
      );

      expect(flexContainer).toBeInTheDocument();

      expect(flexContainer).toHaveClass('d-flex');

      expect(flexContainer).toHaveClass('flex-wrap');
    });

    it('should render configure button', () => {
      render(<ProviderSelector onProviderSelect={mockOnProviderSelect} />);

      expect(screen.getByText('label.configure')).toBeInTheDocument();
    });

    it('should disable configure button when no provider is selected', () => {
      render(<ProviderSelector onProviderSelect={mockOnProviderSelect} />);

      const configureButton = screen.getByRole('button', {
        name: /label.configure/i,
      });

      expect(configureButton).toBeDisabled();
    });
  });

  describe('Provider Selection', () => {
    it('should call onProviderSelect when Google is selected and configure is clicked', async () => {
      render(<ProviderSelector onProviderSelect={mockOnProviderSelect} />);

      const googleCard = screen.getByText('Google').closest('.provider-item');

      expect(googleCard).toBeInTheDocument();

      fireEvent.click(googleCard!);

      expect(googleCard).toHaveClass('selected');

      const configureButton = screen.getByRole('button', {
        name: /label.configure/i,
      });

      expect(configureButton).toBeEnabled();

      fireEvent.click(configureButton);

      await waitFor(() => {
        expect(mockOnProviderSelect).toHaveBeenCalledWith('google');
      });
    });

    it('should call onProviderSelect when Custom OIDC is selected and configure is clicked', async () => {
      render(<ProviderSelector onProviderSelect={mockOnProviderSelect} />);

      const customOidcCard = screen
        .getByText('Custom-OIDC')
        .closest('.provider-item');

      expect(customOidcCard).toBeInTheDocument();

      fireEvent.click(customOidcCard!);

      const configureButton = screen.getByRole('button', {
        name: /label.configure/i,
      });
      fireEvent.click(configureButton);

      await waitFor(() => {
        expect(mockOnProviderSelect).toHaveBeenCalledWith('customOidc');
      });
    });

    it('should call onProviderSelect when SAML is selected and configure is clicked', async () => {
      render(<ProviderSelector onProviderSelect={mockOnProviderSelect} />);

      const samlCard = screen.getByText('SAML').closest('.provider-item');

      expect(samlCard).toBeInTheDocument();

      fireEvent.click(samlCard!);

      const configureButton = screen.getByRole('button', {
        name: /label.configure/i,
      });
      fireEvent.click(configureButton);

      await waitFor(() => {
        expect(mockOnProviderSelect).toHaveBeenCalledWith('saml');
      });
    });

    it('should only call onProviderSelect once per configure click', async () => {
      render(<ProviderSelector onProviderSelect={mockOnProviderSelect} />);

      const googleCard = screen.getByText('Google').closest('.provider-item');
      fireEvent.click(googleCard!);

      const configureButton = screen.getByRole('button', {
        name: /label.configure/i,
      });
      fireEvent.click(configureButton);

      await waitFor(() => {
        expect(mockOnProviderSelect).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Selection State', () => {
    it('should highlight selected provider', () => {
      render(<ProviderSelector onProviderSelect={mockOnProviderSelect} />);

      const googleCard = screen.getByText('Google').closest('.provider-item');
      fireEvent.click(googleCard!);

      expect(googleCard).toHaveClass('selected');
    });

    it('should allow changing selection', () => {
      render(<ProviderSelector onProviderSelect={mockOnProviderSelect} />);

      const googleCard = screen.getByText('Google').closest('.provider-item');
      const oktaCard = screen.getByText('Okta').closest('.provider-item');

      fireEvent.click(googleCard!);

      expect(googleCard).toHaveClass('selected');

      fireEvent.click(oktaCard!);

      expect(oktaCard).toHaveClass('selected');

      expect(googleCard).not.toHaveClass('selected');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible configure button', () => {
      render(<ProviderSelector onProviderSelect={mockOnProviderSelect} />);

      const configureButton = screen.getByRole('button', {
        name: /label.configure/i,
      });

      expect(configureButton).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should not call callback if no provider is selected', () => {
      render(<ProviderSelector onProviderSelect={mockOnProviderSelect} />);

      const configureButton = screen.getByRole('button', {
        name: /label.configure/i,
      });
      fireEvent.click(configureButton);

      expect(mockOnProviderSelect).not.toHaveBeenCalled();
    });
  });
});
