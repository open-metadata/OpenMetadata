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
  AuthenticationConfiguration,
  AuthorizerConfiguration,
} from '../../../constants/SSO.constant';

import { AuthProvider } from '../../../generated/settings/settings';
import { SecurityConfiguration } from '../../../rest/securityConfigAPI';

export interface UISchemaField {
  'ui:title'?: string;
  'ui:widget'?: string;
  'ui:hideError'?: boolean;
  'ui:options'?: Record<string, unknown>;
}

export interface UISchemaObject {
  [key: string]: UISchemaField | UISchemaObject;
}

export interface FormData {
  authenticationConfiguration: AuthenticationConfiguration;
  authorizerConfiguration: AuthorizerConfiguration;
}

export interface SSOConfigurationFormProps {
  forceEditMode?: boolean;
  onChangeProvider?: () => void;
  onProviderSelect?: (provider: AuthProvider) => void;
  selectedProvider?: string;
  hideBorder?: boolean;
  securityConfig?: SecurityConfiguration | null;
}
