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
import APIClient from './index';

export interface SecurityConfiguration {
  authenticationConfiguration: any;
  authorizerConfiguration: any;
}

export interface ValidationResult {
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
