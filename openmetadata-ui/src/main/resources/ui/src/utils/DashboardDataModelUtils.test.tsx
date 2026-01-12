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

import { DataType, DashboardDataModel, TagSource } from '../generated/entity/data/dashboardDataModel';
import { EntityReference } from '../generated/type/entityReference';
import { LabelType, State } from '../generated/type/tagLabel';
import { extractDataModelColumns } from './DashboardDataModelUtils';

type DashboardDataModelTestData = Partial<DashboardDataModel> &
  Pick<Omit<EntityReference, 'type'>, 'id'>;

describe('DashboardDataModelUtils', () => {
  describe('extractDataModelColumns', () => {
    it('should extract columns from data model', () => {
      const mockDataModel: DashboardDataModelTestData = {
        id: 'test-id',
        columns: [
          {
            name: 'column1',
            dataType: DataType.String,
            fullyQualifiedName: 'datamodel.column1',
          },
          {
            name: 'column2',
            dataType: DataType.Int,
            fullyQualifiedName: 'datamodel.column2',
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

      const result = extractDataModelColumns(mockDataModel);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('column1');
      expect(result[0].tags).toEqual([]);
      expect(result[1].name).toBe('column2');
      expect(result[1].tags).toHaveLength(1);
    });

    it('should return empty array when columns are undefined', () => {
      const mockDataModel: DashboardDataModelTestData = {
        id: 'test-id',
      };

      const result = extractDataModelColumns(mockDataModel);

      expect(result).toEqual([]);
    });

    it('should add empty tags array to columns without tags', () => {
      const mockDataModel: DashboardDataModelTestData = {
        id: 'test-id',
        columns: [
          {
            name: 'column1',
            dataType: DataType.String,
            fullyQualifiedName: 'datamodel.column1',
          },
        ],
      };

      const result = extractDataModelColumns(mockDataModel);

      expect(result[0].tags).toEqual([]);
    });

    it('should preserve existing tags', () => {
      const mockDataModel: DashboardDataModelTestData = {
        id: 'test-id',
        columns: [
          {
            name: 'column1',
            dataType: DataType.String,
            fullyQualifiedName: 'datamodel.column1',
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

      const result = extractDataModelColumns(mockDataModel);

      expect(result[0].tags).toHaveLength(2);
      expect(result[0].tags?.[0].tagFQN).toBe('tag1');
      expect(result[0].tags?.[1].tagFQN).toBe('tag2');
    });
  });
});
