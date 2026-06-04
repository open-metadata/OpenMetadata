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

export interface SafeParseResult<T> {
  success: true;
  data: T;
}

export interface SafeParseError {
  success: false;
  error: string;
}

export type SafeParseResultOrError<T> = SafeParseResult<T> | SafeParseError;

export const safeJsonParse = <T>(
  jsonString: string,
): SafeParseResultOrError<T> => {
  if (!jsonString || typeof jsonString !== 'string') {
    return { success: false, error: 'Invalid input: not a string' };
  }

  try {
    const parsed = JSON.parse(jsonString) as T;
    return { success: true, data: parsed };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown parse error';
    return { success: false, error: errorMessage };
  }
};

export const safeJsonParseStrict = <T>(
  jsonString: string | null | undefined,
  fallback: T,
): T => {
  if (!jsonString) {
    return fallback;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
};

export const tryParseJson = <T>(
  jsonString: string | null | undefined,
): T | null => {
  if (!jsonString) {
    return null;
  }

  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return null;
  }
};
