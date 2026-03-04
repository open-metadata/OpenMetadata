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
import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import {
  AuthenticationConfiguration,
  AuthorizerConfiguration,
} from '../constants/SSO.constant';
import APIClient from './index';

export interface SecurityConfiguration {
  authenticationConfiguration: AuthenticationConfiguration;
  authorizerConfiguration: AuthorizerConfiguration;
}

export interface ValidationResult {
  component: string;
  status?: string;
  message?: string;
  error?: boolean;
}

export interface SecurityValidationResponse {
  status: string;
  message: string;
  results: ValidationResult[];
}

/**
 * Validate security configuration
 * @param data - Security configuration data
 * @returns Promise with validation result
 */
export const validateSecurityConfiguration = async (
  data: SecurityConfiguration
): Promise<AxiosResponse<SecurityValidationResponse>> => {
  return APIClient.post<
    SecurityConfiguration,
    AxiosResponse<SecurityValidationResponse>
  >('/system/security/validate', data);
};

/**
 * Apply security configuration
 * @param data - Security configuration data
 * @returns Promise with application result
 */
export const applySecurityConfiguration = async (
  data: SecurityConfiguration
): Promise<AxiosResponse<SecurityConfiguration>> => {
  return APIClient.put<
    SecurityConfiguration,
    AxiosResponse<SecurityConfiguration>
  >('/system/security/config', data);
};

/**
 * Get current security configuration
 * @returns Promise with current configuration
 */
export const getSecurityConfiguration = async (): Promise<
  AxiosResponse<SecurityConfiguration>
> => {
  return APIClient.get<SecurityConfiguration>('/system/security/config');
};

/**
 * Test security configuration connection
 * @param data - Security configuration data
 * @returns Promise with test result
 */
export const testSecurityConfiguration = async (
  data: SecurityConfiguration
): Promise<AxiosResponse<ValidationResult>> => {
  return APIClient.post<SecurityConfiguration, AxiosResponse<ValidationResult>>(
    '/security/config/test',
    data
  );
};

/**
 * Patch authentication configuration with partial updates
 * @param patches - Array of JSON Patch operations
 * @returns Promise with updated configuration
 */
export const patchAuthenticationConfiguration = async (
  patches: Operation[]
): Promise<AxiosResponse<AuthenticationConfiguration>> => {
  return APIClient.patch<
    Operation[],
    AxiosResponse<AuthenticationConfiguration>
  >('/system/settings/authenticationConfiguration', patches, {
    headers: {
      'Content-Type': 'application/json-patch+json',
    },
  });
};

/**
 * Patch authorizer configuration with partial updates
 * @param patches - Array of JSON Patch operations
 * @returns Promise with updated configuration
 */
export const patchAuthorizerConfiguration = async (
  patches: Operation[]
): Promise<AxiosResponse<AuthorizerConfiguration>> => {
  return APIClient.patch<Operation[], AxiosResponse<AuthorizerConfiguration>>(
    '/system/settings/authorizerConfiguration',
    patches,
    {
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    }
  );
};

/**
 * Patch security configuration with partial updates
 * @param patches - Array of JSON Patch operations
 * @returns Promise with updated configuration
 */
export const patchSecurityConfiguration = async (
  patches: Operation[]
): Promise<AxiosResponse<SecurityConfiguration>> => {
  return APIClient.patch<Operation[], AxiosResponse<SecurityConfiguration>>(
    '/system/security/config',
    patches,
    {
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    }
  );
};
