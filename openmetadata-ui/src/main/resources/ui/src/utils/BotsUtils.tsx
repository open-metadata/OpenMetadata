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

import { Select } from '../components/common/AntdCompat';
import { TOKEN_EXPIRY_NUMERIC_VALUES_IN_DAYS } from '../constants/User.constants';
import { JWTTokenExpiry } from '../generated/entity/teams/user';
import {
    DATE_TIME_WEEKDAY_WITH_ORDINAL,
    formatDateTimeLong
} from './date-time/DateTimeUtils';
import { t } from './i18next/LocalUtil';
;

const { Option } = Select;

const getJWTTokenExpiryLabel = (expiry: JWTTokenExpiry) => {
  switch (expiry) {
    case JWTTokenExpiry.OneHour:
      return t('label.1-hr');
    case JWTTokenExpiry.The1:
      return t('label.1-day');
    case JWTTokenExpiry.The7:
      return t('label.number-day-plural', { number: 7 });
    case JWTTokenExpiry.The30:
      return t('label.number-day-plural', { number: 30 });
    case JWTTokenExpiry.The60:
      return t('label.number-day-plural', { number: 60 });
    case JWTTokenExpiry.The90:
      return t('label.number-day-plural', { number: 90 });
    case JWTTokenExpiry.Unlimited:
      return t('label.unlimited');
    default:
      return expiry;
  }
};

export const getJWTTokenExpiryOptions = (filterUnlimited = false) => {
  let finalOptions = Object.values(JWTTokenExpiry).map((expiry) => ({
    label: getJWTTokenExpiryLabel(expiry),
    value: expiry,
    numericValue: TOKEN_EXPIRY_NUMERIC_VALUES_IN_DAYS[expiry],
  }));

  if (filterUnlimited) {
    finalOptions = finalOptions.filter(
      (option) => option.value !== JWTTokenExpiry.Unlimited
    );
  }

  // Create a new array to avoid mutating the original array
  // spread is necessary to avoid the sonar issue:
  // Array-mutating methods should not be used misleadingly typescript:S4043
  const sortedOptions = [...finalOptions].sort(
    (a, b) => a.numericValue - b.numericValue
  );

  return sortedOptions.map((option) => (
    <Option key={option.value}>{option.label}</Option>
  ));
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
