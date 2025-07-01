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

export const USER_DEFAULT_AUTHENTICATION_MECHANISM = {
  tokenType: TokenType.PersonalAccessToken,
};

// Mapping of JWTTokenExpiry enum to numeric values in days
// This is used to sort the options in the JWTTokenExpiry dropdown
export const TOKEN_EXPIRY_NUMERIC_VALUES_IN_DAYS: Record<
  JWTTokenExpiry,
  number
> = {
  [JWTTokenExpiry.OneHour]: 0.0417,
  [JWTTokenExpiry.The1]: 1,
  [JWTTokenExpiry.The7]: 7,
  [JWTTokenExpiry.The30]: 30,
  [JWTTokenExpiry.The60]: 60,
  [JWTTokenExpiry.The90]: 90,
  [JWTTokenExpiry.Unlimited]: Infinity,
};

export const MASKED_EMAIL = '********@masked.com';
