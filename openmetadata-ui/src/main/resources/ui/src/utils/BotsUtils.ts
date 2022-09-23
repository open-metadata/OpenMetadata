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

import { isUndefined } from 'lodash';
import moment from 'moment';
import { AuthTypes } from '../enums/signin.enum';
import { AuthType, JWTTokenExpiry } from '../generated/entity/teams/user';

export const getJWTTokenExpiryOptions = () => {
  return Object.keys(JWTTokenExpiry).map((expiry) => {
    const expiryValue = JWTTokenExpiry[expiry as keyof typeof JWTTokenExpiry];
    const isHourOption = expiryValue === JWTTokenExpiry.OneHour;

    return {
      label: isHourOption ? '1 hr' : `${expiryValue} days`,
      value: expiryValue,
    };
  });
};

export const getAuthMechanismTypeOptions = (
  authConfig: Record<string, string | boolean> | undefined
) => {
  const JWTOption = { label: 'Jwt', value: AuthType.Jwt };
  const SSOOption = { label: 'Google SSO', value: AuthType.Sso };
  /**
   * If no auth is setup return the JWT option only
   */
  if (isUndefined(authConfig)) {
    return [JWTOption];
  } else {
    /**
     * If provider is google then return JWT and SSO options
     * Else return JWT option only
     */
    switch (authConfig?.provider) {
      case AuthTypes.GOOGLE:
        return [JWTOption, SSOOption];
      case AuthTypes.BASIC:
      default:
        return [JWTOption];
    }
  }
};

export const getTokenExpiryText = (expiry: string) => {
  if (expiry === JWTTokenExpiry.Unlimited) {
    return 'The token will never expire!';
  } else if (expiry === JWTTokenExpiry.OneHour) {
    return `The token will expire in ${expiry}`;
  } else {
    return `The token will expire on ${moment()
      .add(expiry, 'days')
      .format('ddd Do MMMM, YYYY')}`;
  }
};
