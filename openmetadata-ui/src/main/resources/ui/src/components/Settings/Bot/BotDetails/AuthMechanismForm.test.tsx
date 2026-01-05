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

import { render, screen, waitFor } from '@testing-library/react';
import { Select } from 'antd';
import {
  PersonalAccessToken,
  TokenType,
} from '../../../../generated/auth/personalAccessToken';
import {
  AuthenticationMechanism,
  AuthType,
  JWTTokenExpiry,
} from '../../../../generated/entity/teams/user';
import { SettingType } from '../../../../generated/settings/settings';
import AuthMechanismForm from './AuthMechanismForm';

const { Option } = Select;

const mockUpdateSettingsConfig = jest.fn();
const mockShowErrorToast = jest.fn();

jest.mock('../../../../rest/settingConfigAPI', () => ({
  updateSettingsConfig: jest.fn((...args) => mockUpdateSettingsConfig(...args)),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn((...args) => mockShowErrorToast(...args)),
}));

jest.mock('../../../../utils/BotsUtils', () => ({
  getJWTTokenExpiryOptions: jest.fn((filterUnlimited: boolean) => {
    const options = [
      { label: '1 hr', value: JWTTokenExpiry.OneHour },
      { label: '1 day', value: JWTTokenExpiry.The1 },
      { label: '7 days', value: JWTTokenExpiry.The7 },
      { label: '30 days', value: JWTTokenExpiry.The30 },
      { label: '60 days', value: JWTTokenExpiry.The60 },
      { label: '90 days', value: JWTTokenExpiry.The90 },
      { label: 'Unlimited', value: JWTTokenExpiry.Unlimited },
    ];

    const filteredOptions = filterUnlimited
      ? options.filter((opt) => opt.value !== JWTTokenExpiry.Unlimited)
      : options;

    return filteredOptions.map((opt) => (
      <Option key={opt.value} value={opt.value}>
        {opt.label}
      </Option>
    ));
  }),
}));

const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();

const mockBotAuthMechanism: AuthenticationMechanism = {
  authType: AuthType.Jwt,
  config: {
    JWTTokenExpiry: JWTTokenExpiry.OneHour,
  },
};

const mockPersonalAccessToken: PersonalAccessToken = {
  tokenType: TokenType.PersonalAccessToken,
  expiryDate: 1234567890,
  token: 'mock-token',
  userId: 'test-user',
};

const defaultProps = {
  isUpdating: false,
  authenticationMechanism: mockBotAuthMechanism,
  onSave: mockOnSave,
  onCancel: mockOnCancel,
  isBot: true,
  isSCIMBot: false,
};

describe('AuthMechanismForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateSettingsConfig.mockResolvedValue({});
  });

  describe('Bot Form Rendering', () => {
    it('should render form for bot with correct initial values', () => {
      render(<AuthMechanismForm {...defaultProps} />);

      expect(screen.getByTestId('auth-mechanism')).toBeInTheDocument();
      expect(screen.getByTestId('token-expiry')).toBeInTheDocument();
      expect(screen.getByTestId('save-edit')).toBeInTheDocument();
    });

    it('should render OpenMetadata JWT as auth mechanism for bot', () => {
      render(<AuthMechanismForm {...defaultProps} />);

      const authMechanismSelect = screen.getByTestId('auth-mechanism');

      expect(authMechanismSelect).toHaveTextContent('OpenMetadata JWT');
    });

    it('should disable auth mechanism select field', () => {
      render(<AuthMechanismForm {...defaultProps} />);

      const authMechanismSelect = screen
        .getByTestId('auth-mechanism')
        .querySelector('input');

      expect(authMechanismSelect).toBeDisabled();
    });

    it('should show cancel button when authenticationMechanism is not empty', () => {
      render(<AuthMechanismForm {...defaultProps} />);

      expect(screen.getByTestId('cancel-edit')).toBeInTheDocument();
    });

    it('should not show cancel button when authenticationMechanism is empty', () => {
      render(
        <AuthMechanismForm
          {...defaultProps}
          authenticationMechanism={{} as AuthenticationMechanism}
        />
      );

      expect(screen.queryByTestId('cancel-edit')).not.toBeInTheDocument();
    });
  });

  describe('Personal Access Token Form', () => {
    const personalAccessTokenProps = {
      ...defaultProps,
      isBot: false,
      authenticationMechanism: mockPersonalAccessToken,
    };

    it('should render form for personal access token', () => {
      render(<AuthMechanismForm {...personalAccessTokenProps} />);

      expect(screen.getByTestId('auth-mechanism')).toBeInTheDocument();
      expect(screen.getByTestId('token-expiry')).toBeInTheDocument();
    });

    it('should render Personal Access Token as auth mechanism', () => {
      render(<AuthMechanismForm {...personalAccessTokenProps} />);

      const authMechanismSelect = screen.getByTestId('auth-mechanism');

      expect(authMechanismSelect).toHaveTextContent('Personal Access Token');
    });

    it('should filter unlimited option for personal access token', () => {
      const {
        getJWTTokenExpiryOptions,
      } = require('../../../../utils/BotsUtils');
      render(<AuthMechanismForm {...personalAccessTokenProps} />);

      expect(getJWTTokenExpiryOptions).toHaveBeenCalledWith(true);
    });

    it('should not filter unlimited option for bot', () => {
      const {
        getJWTTokenExpiryOptions,
      } = require('../../../../utils/BotsUtils');
      render(<AuthMechanismForm {...defaultProps} />);

      expect(getJWTTokenExpiryOptions).toHaveBeenCalledWith(false);
    });
  });

  describe('SCIM Bot', () => {
    const scimBotProps = {
      ...defaultProps,
      isSCIMBot: true,
    };

    it('should render SCIM token generation UI for SCIM bot', () => {
      render(<AuthMechanismForm {...scimBotProps} />);

      expect(screen.getByTestId('generate-scim-token')).toBeInTheDocument();
      expect(screen.queryByTestId('auth-mechanism')).not.toBeInTheDocument();
      expect(screen.queryByTestId('token-expiry')).not.toBeInTheDocument();
    });

    it('should call updateSettingsConfig and onSave when generating SCIM token', async () => {
      render(<AuthMechanismForm {...scimBotProps} />);

      const generateButton = screen.getByTestId('generate-scim-token');
      generateButton.click();

      await waitFor(() => {
        expect(mockUpdateSettingsConfig).toHaveBeenCalledWith({
          config_type: SettingType.ScimConfiguration,
          config_value: {
            enabled: true,
            identityProvider: 'default',
          },
        });
      });

      expect(mockOnSave).toHaveBeenCalledWith({
        authType: AuthType.Jwt,
        config: {
          JWTTokenExpiry: JWTTokenExpiry.Unlimited,
        },
      });
    });

    it('should show error toast when SCIM config update fails', async () => {
      const mockError = new Error('Failed to update SCIM config');
      mockUpdateSettingsConfig.mockRejectedValueOnce(mockError);

      render(<AuthMechanismForm {...scimBotProps} />);

      const generateButton = screen.getByTestId('generate-scim-token');
      generateButton.click();

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(mockError);
      });
    });

    it('should call onSave even if SCIM config update fails', async () => {
      const mockError = new Error('Failed to update SCIM config');
      mockUpdateSettingsConfig.mockRejectedValueOnce(mockError);

      render(<AuthMechanismForm {...scimBotProps} />);

      const generateButton = screen.getByTestId('generate-scim-token');
      generateButton.click();

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          authType: AuthType.Jwt,
          config: {
            JWTTokenExpiry: JWTTokenExpiry.Unlimited,
          },
        });
      });
    });
  });

  describe('Form Interactions', () => {
    it('should call onSave with correct values when form is submitted', async () => {
      render(<AuthMechanismForm {...defaultProps} />);

      const saveButton = screen.getByTestId('save-edit');
      saveButton.click();

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          authType: AuthType.Jwt,
          config: {
            JWTTokenExpiry: JWTTokenExpiry.OneHour,
          },
        });
      });
    });

    it('should call onCancel when cancel button is clicked', () => {
      render(<AuthMechanismForm {...defaultProps} />);

      const cancelButton = screen.getByTestId('cancel-edit');
      cancelButton.click();

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should show loading state on save button when isUpdating is true', () => {
      render(<AuthMechanismForm {...defaultProps} isUpdating />);

      const saveButton = screen.getByTestId('save-edit');

      expect(saveButton).toHaveClass('ant-btn-loading');
    });

    it('should initialize form with default values for bot', () => {
      render(<AuthMechanismForm {...defaultProps} />);

      expect(screen.getByTestId('token-expiry')).toBeInTheDocument();
      expect(screen.getByTestId('auth-mechanism')).toBeInTheDocument();
    });

    it('should initialize form with default values for personal access token', () => {
      render(
        <AuthMechanismForm
          {...defaultProps}
          authenticationMechanism={mockPersonalAccessToken}
          isBot={false}
        />
      );

      expect(screen.getByTestId('token-expiry')).toBeInTheDocument();
      expect(screen.getByTestId('auth-mechanism')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should have required validation on token expiry field', () => {
      render(<AuthMechanismForm {...defaultProps} />);

      const tokenExpiryLabel = screen.getByText('label.token-expiration');

      expect(tokenExpiryLabel).toBeInTheDocument();
      expect(screen.getByTestId('token-expiry')).toBeInTheDocument();
    });

    it('should submit form with default token expiry', async () => {
      render(<AuthMechanismForm {...defaultProps} />);

      const saveButton = screen.getByTestId('save-edit');
      saveButton.click();

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith({
          authType: AuthType.Jwt,
          config: {
            JWTTokenExpiry: JWTTokenExpiry.OneHour,
          },
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined authType for bot', () => {
      const authMechanismWithoutAuthType = {
        config: {
          JWTTokenExpiry: JWTTokenExpiry.OneHour,
        },
      } as AuthenticationMechanism;

      const { container } = render(
        <AuthMechanismForm
          {...defaultProps}
          authenticationMechanism={authMechanismWithoutAuthType}
        />
      );

      expect(container).toBeInTheDocument();
    });

    it('should handle undefined tokenType for personal access token', () => {
      const tokenWithoutType = {
        expiresAt: 1234567890,
      } as unknown as PersonalAccessToken;

      const { container } = render(
        <AuthMechanismForm
          {...defaultProps}
          authenticationMechanism={tokenWithoutType}
          isBot={false}
        />
      );

      expect(container).toBeInTheDocument();
    });

    it('should use JWT as default authType when submitting', async () => {
      const authMechanismWithoutAuthType = {
        config: {
          JWTTokenExpiry: JWTTokenExpiry.OneHour,
        },
      } as AuthenticationMechanism;

      render(
        <AuthMechanismForm
          {...defaultProps}
          authenticationMechanism={authMechanismWithoutAuthType}
        />
      );

      const saveButton = screen.getByTestId('save-edit');
      saveButton.click();

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(
          expect.objectContaining({
            authType: AuthType.Jwt,
          })
        );
      });
    });
  });
});
