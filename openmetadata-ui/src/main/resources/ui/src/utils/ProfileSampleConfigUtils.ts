/*
 *  Copyright 2026 Collate.
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
import {
  ICSamplingConfig,
  SampleConfigType,
} from '../generated/metadataIngestion/databaseServiceProfilerPipeline';

export const STATIC_CONFIG_KEYS: ReadonlyArray<keyof ICSamplingConfig> = [
  'profileSample',
  'profileSampleType',
  'samplingMethodType',
];

export const DYNAMIC_CONFIG_KEYS: ReadonlyArray<keyof ICSamplingConfig> = [
  'smartSampling',
  'thresholds',
];

export const pickConfigForType = (
  config: ICSamplingConfig | undefined,
  type: SampleConfigType
): ICSamplingConfig => {
  if (!config) {
    return {};
  }
  const allowedKeys =
    type === SampleConfigType.Static ? STATIC_CONFIG_KEYS : DYNAMIC_CONFIG_KEYS;
  const result: ICSamplingConfig = {};
  for (const key of allowedKeys) {
    if (config[key] !== undefined) {
      (result as Record<string, unknown>)[key] = config[key];
    }
  }

  return result;
};
