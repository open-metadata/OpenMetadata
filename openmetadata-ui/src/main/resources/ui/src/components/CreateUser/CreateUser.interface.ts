/*
 *  Copyright 2021 Collate
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

import { LoadingState } from 'Models';
import { CreateUser } from '../../generated/api/teams/createUser';
import { Role } from '../../generated/entity/teams/role';
import { Auth0SSOClientConfig } from '../../generated/security/client/auth0SSOClientConfig';
import { AzureSSOClientConfig } from '../../generated/security/client/azureSSOClientConfig';
import { CustomOidcSSOClientConfig } from '../../generated/security/client/customOidcSSOClientConfig';
import { GoogleSSOClientConfig } from '../../generated/security/client/googleSSOClientConfig';
import { OktaSSOClientConfig } from '../../generated/security/client/oktaSSOClientConfig';

export interface CreateUserProps {
  saveState?: LoadingState;
  roles: Array<Role>;
  onSave: (data: CreateUser) => void;
  onCancel: () => void;
  forceBot: boolean;
}

export type SSOClientConfig =
  | GoogleSSOClientConfig
  | Auth0SSOClientConfig
  | AzureSSOClientConfig
  | OktaSSOClientConfig
  | CustomOidcSSOClientConfig;
