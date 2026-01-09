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

import { DataType, Container, TagSource } from '../generated/entity/data/container';
import { EntityReference } from '../generated/type/entityReference';
import { LabelType, State } from '../generated/type/tagLabel';
import { extractContainerColumns } from './ContainerDetailUtils';

type ContainerTestData = Partial<Container> &
  Pick<Omit<EntityReference, 'type'>, 'id'>;

describe('ContainerDetailUtils', () => {
  describe('extractContainerColumns', () => {
    it('should extract columns from container data model', () => {
      const mockContainer: ContainerTestData = {
        id: 'test-id',
        dataModel: {
          columns: [
            {
              name: 'column1',
              dataType: DataType.String,
              fullyQualifiedName: 'container.column1',
            },
            {
              name: 'column2',
              dataType: DataType.Int,
              fullyQualifiedName: 'container.column2',
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
        },
      };

      const result = extractContainerColumns(mockContainer);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('column1');
      expect(result[0].tags).toEqual([]);
      expect(result[1].name).toBe('column2');
      expect(result[1].tags).toHaveLength(1);
    });

    it('should return empty array when dataModel is undefined', () => {
      const mockContainer: ContainerTestData = {
        id: 'test-id',
      };

      const result = extractContainerColumns(mockContainer);

      expect(result).toEqual([]);
    });

    it('should return empty array when columns are undefined', () => {
      const mockContainer: ContainerTestData = {
        id: 'test-id',
        dataModel: {
          columns: [],
        },
      };

      const result = extractContainerColumns(mockContainer);

      expect(result).toEqual([]);
    });

    it('should add empty tags array to columns without tags', () => {
      const mockContainer: ContainerTestData = {
        id: 'test-id',
        dataModel: {
          columns: [
            {
              name: 'column1',
              dataType: DataType.String,
              fullyQualifiedName: 'container.column1',
            },
          ],
        },
      };

      const result = extractContainerColumns(mockContainer);

      expect(result[0].tags).toEqual([]);
    });

    it('should preserve existing tags', () => {
      const mockContainer: ContainerTestData = {
        id: 'test-id',
        dataModel: {
          columns: [
            {
              name: 'column1',
              dataType: DataType.String,
              fullyQualifiedName: 'container.column1',
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
        },
      };

      const result = extractContainerColumns(mockContainer);

      expect(result[0].tags).toHaveLength(2);
      expect(result[0].tags?.[0].tagFQN).toBe('tag1');
      expect(result[0].tags?.[1].tagFQN).toBe('tag2');
    });
  });
});
