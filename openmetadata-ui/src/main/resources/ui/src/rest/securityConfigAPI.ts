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
import { FieldError } from '../generated/system/securityValidationResponse';
import APIClient from './index';

export interface SecurityConfiguration {
  authenticationConfiguration: AuthenticationConfiguration;
  authorizerConfiguration: AuthorizerConfiguration;
}

export interface SecurityValidationResponse {
  status: 'success' | 'failed';
  errors?: FieldError[];
}

export interface TestLoginDomainCheck {
  enforced?: boolean;
  principalDomain?: string;
  resolvedDomain?: string;
  passed?: boolean;
}

export interface TestLoginResult {
  status: 'success' | 'failed';
  stage?: string;
  resolvedPrincipal?: string;
  resolvedEmail?: string;
  mappedRoles?: string[];
  mappedTeams?: string[];
  domainCheck?: TestLoginDomainCheck;
  errors?: string[];
}

export interface TestLoginTokenRequest {
  securityConfiguration: SecurityConfiguration;
  idToken: string;
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
 * Validate a browser-obtained OIDC id_token against a candidate (unsaved)
 * security configuration. Admin-only. Performs no side effects on the server.
 * @param data - Candidate security configuration and the obtained id_token
 * @returns Promise with the dry-run test login result
 */
export const testLoginValidateToken = async (
  data: TestLoginTokenRequest
): Promise<AxiosResponse<TestLoginResult>> => {
  return APIClient.post<TestLoginTokenRequest, AxiosResponse<TestLoginResult>>(
    '/system/security/test-login/validate-token',
    data
  );
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
