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

import { round, toNumber } from 'lodash';
import i18n from './i18next/LocalUtil';

export const formatNumberWithComma = (number: number) => {
  return new Intl.NumberFormat(i18n.language).format(number);
};

/**
 * If the number is a time format, return the number, otherwise format the number with commas
 * @param {number} number - The number to be formatted.
 * @returns A function that takes a number and returns a string.
 */
export const getStatisticsDisplayValue = (
  number: string | number | undefined
) => {
  const displayValue = toNumber(number);

  if (isNaN(displayValue)) {
    return number;
  }

  return formatNumberWithComma(displayValue);
};

export const digitFormatter = (value: number) => {
  // convert 1000 to 1k
  return Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Provide the calculated percentage value from the number provided
 * @param value - value on which percentage will be calculated
 * @param percentageValue - PercentageValue like 20, 35 or 50
 * @returns {number} - value derived after calculating percentage, like for 1000 on 10% = 100
 */
export const calculatePercentageFromValue = (
  value: number,
  percentageValue: number
) => {
  return (value * percentageValue) / 100;
};

/**
 * Calculates percentage from numerator and denominator with safe division
 * @param numerator - The numerator value
 * @param denominator - The denominator value
 * @param precision - Number of decimal places to round to (default: 1)
 * @param format - If true, returns formatted string with % symbol (default: false)
 * @returns Calculated percentage rounded to precision, or 0 if denominator is 0.
 *          Returns string if format is true.
 * @example
 * calculatePercentage(25, 100) // returns 25.0
 * calculatePercentage(1, 3, 2) // returns 33.33
 * calculatePercentage(5, 0) // returns 0 (safe division)
 * calculatePercentage(25, 100, 2, true) // returns "25%"
 * calculatePercentage(1, 3, 2, true) // returns "33.33%"
 */
export const calculatePercentage = (
  numerator: number,
  denominator: number,
  precision = 1,
  format = false
): number | string => {
  if (denominator === 0) {
    return format ? '0%' : 0;
  }

  const percentageValue = round((numerator / denominator) * 100, precision);

  if (format) {
    // Convert to string and remove trailing zeros
    return `${parseFloat(percentageValue.toFixed(precision))}%`;
  }

  return percentageValue;
};
