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

import {
  FeatureType,
  Mlmodel,
  TagSource,
} from '../generated/entity/data/mlmodel';
import { EntityReference } from '../generated/type/entityReference';
import { LabelType, State } from '../generated/type/tagLabel';
import { extractMlModelFeatures } from './MlModelDetailsUtils';

type MlModelTestData = Partial<Mlmodel> &
  Pick<Omit<EntityReference, 'type'>, 'id'>;

describe('MlModelDetailsUtils', () => {
  describe('extractMlModelFeatures', () => {
    it('should extract features from ml model', () => {
      const mockMlModel: MlModelTestData = {
        id: 'test-id',
        mlFeatures: [
          {
            name: 'feature1',
            dataType: FeatureType.Numerical,
            fullyQualifiedName: 'mlmodel.feature1',
            description: 'Test feature 1',
          },
          {
            name: 'feature2',
            dataType: FeatureType.Categorical,
            fullyQualifiedName: 'mlmodel.feature2',
            description: 'Test feature 2',
          },
        ],
      };

      const result = extractMlModelFeatures(mockMlModel);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('feature1');
      expect(result[0].dataType).toBe(FeatureType.Numerical);
      expect(result[1].name).toBe('feature2');
      expect(result[1].dataType).toBe(FeatureType.Categorical);
    });

    it('should return empty array when mlFeatures are undefined', () => {
      const mockMlModel: MlModelTestData = {
        id: 'test-id',
      };

      const result = extractMlModelFeatures(mockMlModel);

      expect(result).toEqual([]);
    });

    it('should return empty array when mlFeatures is null', () => {
      // Test null case by using a type that allows null for mlFeatures
      const mockMlModel = {
        id: 'test-id',
        mlFeatures: null,
      } as Omit<MlModelTestData, 'mlFeatures'> & {
        mlFeatures: null;
      };

      const result = extractMlModelFeatures(mockMlModel);

      expect(result).toEqual([]);
    });

    it('should return empty array when mlFeatures is empty array', () => {
      const mockMlModel: MlModelTestData = {
        id: 'test-id',
        mlFeatures: [],
      };

      const result = extractMlModelFeatures(mockMlModel);

      expect(result).toEqual([]);
    });

    it('should preserve all feature properties', () => {
      const mockMlModel: MlModelTestData = {
        id: 'test-id',
        mlFeatures: [
          {
            name: 'feature1',
            dataType: FeatureType.Numerical,
            fullyQualifiedName: 'mlmodel.feature1',
            description: 'Test description',
            featureAlgorithm: 'PCA',
            featureSources: [],
            tags: [
              {
                tagFQN: 'tag1',
                source: TagSource.Classification,
                labelType: LabelType.Manual,
                state: State.Confirmed,
              },
            ],
          },
        ],
      };

      const result = extractMlModelFeatures(mockMlModel);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('feature1');
      expect(result[0].dataType).toBe(FeatureType.Numerical);
      expect(result[0].fullyQualifiedName).toBe('mlmodel.feature1');
      expect(result[0].description).toBe('Test description');
      expect(result[0].featureAlgorithm).toBe('PCA');
      expect(result[0].featureSources).toEqual([]);
      expect(result[0].tags).toHaveLength(1);
    });

    it('should handle features with tags', () => {
      const mockMlModel: MlModelTestData = {
        id: 'test-id',
        mlFeatures: [
          {
            name: 'feature1',
            dataType: FeatureType.Numerical,
            fullyQualifiedName: 'mlmodel.feature1',
            tags: [
              {
                tagFQN: 'tag1',
                source: TagSource.Classification,
                labelType: LabelType.Manual,
                state: State.Confirmed,
              },
              {
                tagFQN: 'tag2',
                source: TagSource.Glossary,
                labelType: LabelType.Manual,
                state: State.Confirmed,
              },
            ],
          },
        ],
      };

      const result = extractMlModelFeatures(mockMlModel);

      expect(result[0].tags).toHaveLength(2);
      expect(result[0].tags?.[0].tagFQN).toBe('tag1');
      expect(result[0].tags?.[1].tagFQN).toBe('tag2');
    });

    it('should handle features without tags', () => {
      const mockMlModel: MlModelTestData = {
        id: 'test-id',
        mlFeatures: [
          {
            name: 'feature1',
            dataType: FeatureType.Numerical,
            fullyQualifiedName: 'mlmodel.feature1',
          },
        ],
      };

      const result = extractMlModelFeatures(mockMlModel);

      expect(result[0].tags).toBeUndefined();
    });

    it('should handle multiple features with different properties', () => {
      const mockMlModel: MlModelTestData = {
        id: 'test-id',
        mlFeatures: [
          {
            name: 'feature1',
            dataType: FeatureType.Numerical,
            fullyQualifiedName: 'mlmodel.feature1',
          },
          {
            name: 'feature2',
            dataType: FeatureType.Categorical,
            fullyQualifiedName: 'mlmodel.feature2',
            featureAlgorithm: 'Bucketing',
            tags: [
              {
                tagFQN: 'tag1',
                source: TagSource.Classification,
                labelType: LabelType.Manual,
                state: State.Confirmed,
              },
            ],
          },
          {
            name: 'feature3',
            fullyQualifiedName: 'mlmodel.feature3',
            description: 'Feature without data type',
          },
        ],
      };

      const result = extractMlModelFeatures(mockMlModel);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('feature1');
      expect(result[1].name).toBe('feature2');
      expect(result[1].featureAlgorithm).toBe('Bucketing');
      expect(result[2].name).toBe('feature3');
      expect(result[2].description).toBe('Feature without data type');
    });
  });
});
