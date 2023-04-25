/*
 *  Copyright 2022 Collate.
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

import { t } from 'i18next';
import { AuthenticationMechanism } from '../generated/api/teams/createUser';

import { AuthType, JWTTokenExpiry, User } from '../generated/entity/teams/user';
import { getExpiryDateTimeFromTimeStamp } from './TimeUtils';

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

export const getJWTOption = () => {
  return {
    label: `${t('label.open-metadata')} ${t('label.jwt-uppercase')}`,
    value: AuthType.Jwt,
  };
};

/**
 *
 * @param expiry expiry timestamp
 * @returns TokenExpiry
 */
export const getTokenExpiry = (expiry: number) => {
  // get the current date timestamp
  const currentTimeStamp = Date.now();

  const isTokenExpired = currentTimeStamp >= expiry;

  return {
    tokenExpiryDate: getExpiryDateTimeFromTimeStamp(expiry),
    isTokenExpired,
  };
};

export const getAuthMechanismFormInitialValues = (
  authMechanism: AuthenticationMechanism,
  botUser: User
) => {
  const authConfig = authMechanism.config?.authConfig;
  const email = botUser.email;

  return {
    audience: authConfig?.audience,
    secretKey: authConfig?.secretKey,

    clientId: authConfig?.clientId,

    oktaEmail: authConfig?.email,

    orgURL: authConfig?.orgURL,

    privateKey: authConfig?.privateKey,

    scopes: authConfig?.scopes?.join(','),

    domain: authConfig?.domain,

    authority: authConfig?.authority,

    clientSecret: authConfig?.clientSecret,

    tokenEndpoint: authConfig?.tokenEndpoint,
    email,
  };
};
