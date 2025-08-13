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
import { getOidcToken } from '../utils/LocalStorageUtils';

export interface SecurityConfiguration {
  authenticationConfiguration: {
    provider: string;
    providerName: string;
    clientType?: string;
    responseType?: string;
    authority?: string;
    clientId?: string;
    callbackUrl?: string;
    publicKeyUrls?: string[];
    tokenValidationAlgorithm?: string;
    jwtPrincipalClaims?: string[];
    jwtPrincipalClaimsMapping?: string[];
    enableSelfSignup?: boolean;
    // Provider-specific fields
    secretKey?: string;
    audience?: string;
    domain?: string;
    clientSecret?: string;
    scopes?: string[];
  };
  authorizerConfiguration: {
    className: string;
    containerRequestFilter: string;
    adminPrincipals: string[];
    principalDomain: string;
    enforcePrincipalDomain: boolean;
    enableSecureSocketConnection: boolean;
    botPrincipals?: string[];
    testPrincipals?: string[];
    allowedEmailRegistrationDomains?: string[];
    allowedDomains?: string[];
    useRolesFromProvider?: boolean;
  };
}

export interface ValidationResult {
  error?: boolean;
  status?: string;
  message?: string;
}

const getAuthHeaders = async (): Promise<HeadersInit> => {
  const token = getOidcToken();

  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

/**
 * Validate security configuration
 */
export const validateSecurityConfiguration = async (
  config: SecurityConfiguration
): Promise<ValidationResult> => {
  try {
    const response = await fetch('/api/v1/system/security/validate', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(config),
    });

    const result = await response.json();

    if (response.ok) {
      return result;
    } else {
      return {
        error: true,
        status: 'failed',
        message: result.message || 'Validation failed',
      };
    }
  } catch (error) {
    return {
      error: true,
      status: 'failed',
      message: error instanceof Error ? error.message : 'Validation failed',
    };
  }
};

/**
 * Apply security configuration
 */
export const applySecurityConfiguration = async (
  config: SecurityConfiguration
): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await fetch('/api/v1/system/security/config', {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(config),
    });

    if (response.ok) {
      return { success: true, message: 'Configuration applied successfully' };
    } else {
      const error = await response.json();

      return {
        success: false,
        message: error.message,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Configuration failed',
    };
  }
};

/**
 * Get current security configuration
 */
export const getCurrentSecurityConfiguration =
  async (): Promise<SecurityConfiguration | null> => {
    try {
      const response = await fetch('/api/v1/system/security/config', {
        method: 'GET',
        headers: await getAuthHeaders(),
      });

      if (response.ok) {
        return await response.json();
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  };

/**
 * Test connection to security provider
 */
export const testSecurityConnection = async (
  config: SecurityConfiguration
): Promise<{ success: boolean; message?: string }> => {
  try {
    const response = await fetch('/api/v1/system/security/test-connection', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(config),
    });

    if (response.ok) {
      return { success: true, message: 'Connection test successful' };
    } else {
      const error = await response.json();

      return {
        success: false,
        message: error.message,
      };
    }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Connection test failed',
    };
  }
};
