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
export const MONTHS_IN_YEAR = 12;
export const DAYS_IN_MONTH = 30;
export const HOURS_IN_DAY = 24;
export const HOUR_SECONDS = 3600;
export const MINUTE_SECONDS = 60;
export const YEAR_SECONDS =
  MONTHS_IN_YEAR * DAYS_IN_MONTH * HOURS_IN_DAY * HOUR_SECONDS; // 31,104,000 seconds (12 months × 30 days)
export const MONTH_SECONDS = DAYS_IN_MONTH * HOURS_IN_DAY * HOUR_SECONDS; // 2,592,000 seconds (average month)
export const DAY_SECONDS = HOURS_IN_DAY * HOUR_SECONDS; // 86,400 seconds
