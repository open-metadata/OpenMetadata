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

import { JWTTokenExpiry } from '../generated/entity/teams/user';
import {
  DATE_TIME_WEEKDAY_WITH_ORDINAL,
  formatDateTimeLong,
} from './date-time/DateTimeUtils';

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
    tokenExpiryDate: formatDateTimeLong(expiry, DATE_TIME_WEEKDAY_WITH_ORDINAL),
    isTokenExpired,
  };
};
