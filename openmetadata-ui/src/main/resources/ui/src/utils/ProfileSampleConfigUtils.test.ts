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
  ProfileSampleType,
  SampleConfigType,
  SamplingMethodType,
} from '../generated/metadataIngestion/databaseServiceProfilerPipeline';
import {
  DYNAMIC_CONFIG_KEYS,
  pickConfigForType,
  STATIC_CONFIG_KEYS,
} from './ProfileSampleConfigUtils';

describe('ProfileSampleConfigUtils', () => {
  describe('discriminator key constants', () => {
    it('STATIC_CONFIG_KEYS contains only static-side fields', () => {
      expect(STATIC_CONFIG_KEYS).toEqual([
        'profileSample',
        'profileSampleType',
        'samplingMethodType',
      ]);
    });

    it('DYNAMIC_CONFIG_KEYS contains only dynamic-side fields', () => {
      expect(DYNAMIC_CONFIG_KEYS).toEqual(['smartSampling', 'thresholds']);
    });

    it('STATIC_CONFIG_KEYS and DYNAMIC_CONFIG_KEYS are disjoint', () => {
      const intersection = STATIC_CONFIG_KEYS.filter((key) =>
        (DYNAMIC_CONFIG_KEYS as ReadonlyArray<string>).includes(key)
      );

      expect(intersection).toEqual([]);
    });
  });

  describe('pickConfigForType', () => {
    it('returns an empty object when config is undefined (STATIC)', () => {
      expect(pickConfigForType(undefined, SampleConfigType.Static)).toEqual({});
    });

    it('returns an empty object when config is undefined (DYNAMIC)', () => {
      expect(pickConfigForType(undefined, SampleConfigType.Dynamic)).toEqual(
        {}
      );
    });

    it('returns an empty object when config has no recognised keys (STATIC)', () => {
      expect(pickConfigForType({}, SampleConfigType.Static)).toEqual({});
    });

    it('STATIC drops smartSampling and thresholds, keeps profileSample', () => {
      const polluted: ICSamplingConfig = {
        smartSampling: true,
        thresholds: [],
        profileSample: 10,
      };

      expect(pickConfigForType(polluted, SampleConfigType.Static)).toEqual({
        profileSample: 10,
      });
    });

    it('STATIC preserves all three static-only fields when present', () => {
      const config: ICSamplingConfig = {
        profileSample: 25,
        profileSampleType: ProfileSampleType.Rows,
        samplingMethodType: SamplingMethodType.System,
      };

      expect(pickConfigForType(config, SampleConfigType.Static)).toEqual(
        config
      );
    });

    it('DYNAMIC drops profileSample/profileSampleType/samplingMethodType, keeps smartSampling and thresholds', () => {
      const polluted: ICSamplingConfig = {
        smartSampling: false,
        thresholds: [{ rowCountThreshold: 1000, profileSample: 50 }],
        profileSample: 10,
        profileSampleType: ProfileSampleType.Percentage,
        samplingMethodType: SamplingMethodType.Bernoulli,
      };

      expect(pickConfigForType(polluted, SampleConfigType.Dynamic)).toEqual({
        smartSampling: false,
        thresholds: [{ rowCountThreshold: 1000, profileSample: 50 }],
      });
    });

    it('skips keys whose value is undefined', () => {
      const config: ICSamplingConfig = {
        profileSample: undefined,
        profileSampleType: ProfileSampleType.Percentage,
      };

      expect(pickConfigForType(config, SampleConfigType.Static)).toEqual({
        profileSampleType: ProfileSampleType.Percentage,
      });
    });

    it('does not mutate the input config', () => {
      const original: ICSamplingConfig = {
        smartSampling: true,
        thresholds: [],
        profileSample: 10,
      };
      const snapshot = JSON.stringify(original);

      pickConfigForType(original, SampleConfigType.Static);

      expect(JSON.stringify(original)).toBe(snapshot);
    });
  });
});
