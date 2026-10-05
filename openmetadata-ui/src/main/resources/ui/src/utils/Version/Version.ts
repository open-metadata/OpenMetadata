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
import { snakeCase } from 'lodash';
import { DateTime } from 'luxon';

export const getVersionedStorageKey = (key: string, appVersion?: string) => {
  const versionedKey = key + '_' + snakeCase(appVersion ?? '');

  return versionedKey;
};

/**
 * Drops the build segment from a version string for display.
 * "1.13.202609250000" -> "1.13"
 */
export const getSimplifiedVersion = (version?: string): string =>
  (version ?? '').split('.').slice(0, 2).join('.');

/**
 * Derives the release date from the build segment (YYYYMMDDHHMM) of a version
 * string. Parsed in the local zone so a same-zone format call does not drift a
 * day. Returns undefined for clean releases without a 12-digit build stamp.
 */
export const getVersionReleaseTimestamp = (
  version?: string
): number | undefined => {
  const build = (version ?? '').split('.').pop() ?? '';
  if (!/^\d{12}$/.test(build)) {
    return undefined;
  }
  const dt = DateTime.fromFormat(build, 'yyyyMMddHHmm');

  return dt.isValid ? dt.toMillis() : undefined;
};
