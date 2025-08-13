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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  applySecurityConfiguration,
  validateSecurityConfiguration,
} from '../../../rest/securityConfigAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import SSOConfigurationFormRJSF from '../SSOConfigurationForm';

// Mock dependencies
jest.mock('../../../utils/ToastUtils');
jest.mock('../../../rest/securityConfigAPI');
jest.mock('../../../hooks/useApplicationStore');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockShowErrorToast = showErrorToast as jest.MockedFunction<
  typeof showErrorToast
>;
const mockApplySecurityConfiguration =
  applySecurityConfiguration as jest.MockedFunction<
    typeof applySecurityConfiguration
  >;
const mockValidateSecurityConfiguration =
  validateSecurityConfiguration as jest.MockedFunction<
    typeof validateSecurityConfiguration
  >;

const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
>;

describe('SSOConfigurationFormRJSF', () => {
  const mockSetIsAuthenticated = jest.fn();
  const mockSetAuthConfig = jest.fn();
  const mockSetAuthorizerConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseApplicationStore.mockReturnValue({
      setIsAuthenticated: mockSetIsAuthenticated,
      setAuthConfig: mockSetAuthConfig,
      setAuthorizerConfig: mockSetAuthorizerConfig,
    } as any);
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <SSOConfigurationFormRJSF />
      </MemoryRouter>
    );
  };

  describe('Initial Render', () => {
    it('should render the component with edit button', () => {
      renderComponent();

      expect(screen.getByText('label.sso-configuration')).toBeInTheDocument();
      expect(screen.getByText('label.edit')).toBeInTheDocument();
      expect(
        screen.getByText('message.sso-configuration-directly-from-the-ui')
      ).toBeInTheDocument();
    });

    it('should not show form initially', () => {
      renderComponent();

      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('should show form when edit button is clicked', async () => {
      renderComponent();

      const editButton = screen.getByText('label.edit');
      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(screen.getByText('label.save')).toBeInTheDocument();
      expect(screen.getByText('label.cancel')).toBeInTheDocument();
    });

    it('should hide form when cancel button is clicked', async () => {
      renderComponent();

      const editButton = screen.getByText('label.edit');
      await act(async () => {
        fireEvent.click(editButton);
      });

      const cancelButton = screen.getByText('label.cancel');
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(screen.queryByText('label.save')).not.toBeInTheDocument();
      expect(screen.queryByText('label.cancel')).not.toBeInTheDocument();
    });
  });

  describe('Validation Error Handling', () => {
    it('should display validation errors when validation fails', async () => {
      const mockValidationResponse = {
        data: {
          status: 'failed',
          message: 'Security configuration validation found issues',
          results: [
            {
              component: 'authentication-base',
              status: 'failed',
              message: 'Authentication JWT principal claims are required',
            },
            {
              component: 'authentication',
              status: 'failed',
              message: 'Unknown authentication provider: basic',
            },
          ],
        },
      };

      mockValidateSecurityConfiguration.mockResolvedValue(
        mockValidationResponse as any
      );

      renderComponent();

      const editButton = screen.getByText('label.edit');
      await act(async () => {
        fireEvent.click(editButton);
      });

      const saveButton = screen.getByText('label.save');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(
          expect.stringContaining(
            'Security configuration validation found issues'
          )
        );
      });
    });

    it('should handle validation success and proceed to save', async () => {
      const mockValidationResponse = {
        data: {
          status: 'success',
          message: 'Validation successful',
          results: [],
        },
      };

      mockValidateSecurityConfiguration.mockResolvedValue(
        mockValidationResponse as any
      );
      mockApplySecurityConfiguration.mockResolvedValue({ status: 200 } as any);

      renderComponent();

      const editButton = screen.getByText('label.edit');
      await act(async () => {
        fireEvent.click(editButton);
      });

      const saveButton = screen.getByText('label.save');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockApplySecurityConfiguration).toHaveBeenCalled();
      });
    });
  });

  describe('Save Configuration', () => {
    it('should handle save configuration success', async () => {
      const mockValidationResponse = {
        data: {
          status: 'success',
          message: 'Validation successful',
          results: [],
        },
      };

      mockValidateSecurityConfiguration.mockResolvedValue(
        mockValidationResponse as any
      );
      mockApplySecurityConfiguration.mockResolvedValue({ status: 200 } as any);

      renderComponent();

      const editButton = screen.getByText('label.edit');
      await act(async () => {
        fireEvent.click(editButton);
      });

      const saveButton = screen.getByText('label.save');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockApplySecurityConfiguration).toHaveBeenCalled();
      });
    });

    it('should handle save configuration error', async () => {
      const mockValidationResponse = {
        data: {
          status: 'success',
          message: 'Validation successful',
          results: [],
        },
      };

      const mockError = new AxiosError();
      mockError.response = {
        data: {
          responseMessage:
            'Failed to update security configuration: Failed to reload security system',
        },
      } as any;

      mockValidateSecurityConfiguration.mockResolvedValue(
        mockValidationResponse as any
      );
      mockApplySecurityConfiguration.mockRejectedValue(mockError);

      renderComponent();

      const editButton = screen.getByText('label.edit');
      await act(async () => {
        fireEvent.click(editButton);
      });

      const saveButton = screen.getByText('label.save');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(mockError);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle validation API errors', async () => {
      const mockError = new AxiosError();
      mockValidateSecurityConfiguration.mockRejectedValue(mockError);

      renderComponent();

      const editButton = screen.getByText('label.edit');
      await act(async () => {
        fireEvent.click(editButton);
      });

      const saveButton = screen.getByText('label.save');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(mockError);
      });
    });

    it('should handle network errors gracefully', async () => {
      const mockError = new Error('Network error');
      mockValidateSecurityConfiguration.mockRejectedValue(mockError);

      renderComponent();

      const editButton = screen.getByText('label.edit');
      await act(async () => {
        fireEvent.click(editButton);
      });

      const saveButton = screen.getByText('label.save');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(mockError);
      });
    });
  });
});
