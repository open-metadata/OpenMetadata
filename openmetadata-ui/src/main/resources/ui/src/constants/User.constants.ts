/*
 *  Copyright 2024 Collate.
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

import { TokenType } from '../generated/auth/personalAccessToken';
import { JWTTokenExpiry } from '../generated/entity/teams/user';
import { t } from '../utils/i18next/LocalUtil';

export const USER_DEFAULT_AUTHENTICATION_MECHANISM = {
  tokenType: TokenType.PersonalAccessToken,
};

export const JWT_TOKEN_EXPIRY_OPTIONS = [
  {
    label: t('label.1-hr'),
    value: JWTTokenExpiry.OneHour,
  },
  {
    label: t('label.1-day'),
    value: JWTTokenExpiry.The1,
  },
  {
    label: t('label.number-day-plural', { number: 7 }),
    value: JWTTokenExpiry.The7,
  },
  {
    label: t('label.number-day-plural', { number: 30 }),
    value: JWTTokenExpiry.The30,
  },
  {
    label: t('label.number-day-plural', { number: 60 }),
    value: JWTTokenExpiry.The60,
  },
  {
    label: t('label.number-day-plural', { number: 90 }),
    value: JWTTokenExpiry.The90,
  },
  {
    label: t('label.unlimited'),
    value: JWTTokenExpiry.Unlimited,
  },
];

export const MASKED_EMAIL = '********@masked.com';
