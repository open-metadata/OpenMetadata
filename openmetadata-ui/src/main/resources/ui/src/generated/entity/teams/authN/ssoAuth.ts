/* eslint-disable @typescript-eslint/no-explicit-any */
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

/**
 * User/Bot SSOAuthN.
 */
export interface SsoAuth {
  /**
   * Type of database service such as Amundsen, Atlas...
   */
  ssoServiceType?: SsoServiceType;
}

/**
 * Type of database service such as Amundsen, Atlas...
 */
export enum SsoServiceType {
  Auth0 = 'Auth0',
  Azure = 'Azure',
  CustomOIDC = 'CustomOIDC',
  Google = 'Google',
  Okta = 'Okta',
}
