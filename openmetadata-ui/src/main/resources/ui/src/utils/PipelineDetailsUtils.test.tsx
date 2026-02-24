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

import { Pipeline, TagSource } from '../generated/entity/data/pipeline';
import { EntityReference } from '../generated/type/entityReference';
import { LabelType, State } from '../generated/type/tagLabel';
import { extractPipelineTasks } from './PipelineDetailsUtils';

type PipelineTestData = Partial<Pipeline> &
  Pick<Omit<EntityReference, 'type'>, 'id'>;

describe('PipelineDetailsUtils', () => {
  describe('extractPipelineTasks', () => {
    it('should extract tasks from pipeline', () => {
      const mockPipeline: PipelineTestData = {
        id: 'test-id',
        tasks: [
          {
            name: 'task1',
            fullyQualifiedName: 'pipeline.task1',
            displayName: 'Task 1',
          },
          {
            name: 'task2',
            fullyQualifiedName: 'pipeline.task2',
            displayName: 'Task 2',
          },
        ],
      };

      const result = extractPipelineTasks(mockPipeline);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('task1');
      expect(result[0].tags).toEqual([]);
      expect(result[1].name).toBe('task2');
      expect(result[1].tags).toEqual([]);
    });

    it('should return empty array when tasks are undefined', () => {
      const mockPipeline: PipelineTestData = {
        id: 'test-id',
      };

      const result = extractPipelineTasks(mockPipeline);

      expect(result).toEqual([]);
    });

    it('should return empty array when tasks is null', () => {
      const mockPipeline = {
        id: 'test-id',
        tasks: null,
      } as Omit<PipelineTestData, 'tasks'> & {
        tasks: null;
      };

      const result = extractPipelineTasks(mockPipeline);

      expect(result).toEqual([]);
    });

    it('should return empty array when tasks is empty array', () => {
      const mockPipeline: PipelineTestData = {
        id: 'test-id',
        tasks: [],
      };

      const result = extractPipelineTasks(mockPipeline);

      expect(result).toEqual([]);
    });

    it('should add empty tags array to tasks without tags', () => {
      const mockPipeline: PipelineTestData = {
        id: 'test-id',
        tasks: [
          {
            name: 'task1',
            fullyQualifiedName: 'pipeline.task1',
          },
        ],
      };

      const result = extractPipelineTasks(mockPipeline);

      expect(result[0].tags).toEqual([]);
    });

    it('should preserve existing tags', () => {
      const mockPipeline: PipelineTestData = {
        id: 'test-id',
        tasks: [
          {
            name: 'task1',
            fullyQualifiedName: 'pipeline.task1',
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

      const result = extractPipelineTasks(mockPipeline);

      expect(result[0].tags).toHaveLength(2);
      expect(result[0].tags?.[0].tagFQN).toBe('tag1');
      expect(result[0].tags?.[1].tagFQN).toBe('tag2');
    });

    it('should handle tasks with null tags', () => {
      const mockPipeline: PipelineTestData = {
        id: 'test-id',
        tasks: [
          {
            name: 'task1',
            fullyQualifiedName: 'pipeline.task1',
            tags: null as unknown as undefined,
          },
        ],
      };

      const result = extractPipelineTasks(mockPipeline);

      expect(result).toHaveLength(1);
      expect(result[0].tags).toEqual([]);
    });

    it('should preserve all task properties', () => {
      const mockPipeline: PipelineTestData = {
        id: 'test-id',
        tasks: [
          {
            name: 'task1',
            fullyQualifiedName: 'pipeline.task1',
            displayName: 'Task 1',
            description: 'Test task description',
            sourceUrl: 'http://example.com/task1',
            startDate: '2024-01-01',
            endDate: '2024-01-02',
            downstreamTasks: ['task2'],
          },
        ],
      };

      const result = extractPipelineTasks(mockPipeline);

      expect(result[0].name).toBe('task1');
      expect(result[0].fullyQualifiedName).toBe('pipeline.task1');
      expect(result[0].displayName).toBe('Task 1');
      expect(result[0].description).toBe('Test task description');
      expect(result[0].sourceUrl).toBe('http://example.com/task1');
      expect(result[0].startDate).toBe('2024-01-01');
      expect(result[0].endDate).toBe('2024-01-02');
      expect(result[0].downstreamTasks).toEqual(['task2']);
      expect(result[0].tags).toEqual([]);
    });

    it('should handle multiple tasks with mixed tag states', () => {
      const mockPipeline: PipelineTestData = {
        id: 'test-id',
        tasks: [
          {
            name: 'task1',
            fullyQualifiedName: 'pipeline.task1',
          },
          {
            name: 'task2',
            fullyQualifiedName: 'pipeline.task2',
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
            name: 'task3',
            fullyQualifiedName: 'pipeline.task3',
            tags: null as unknown as undefined,
          },
        ],
      };

      const result = extractPipelineTasks(mockPipeline);

      expect(result).toHaveLength(3);
      expect(result[0].tags).toEqual([]);
      expect(result[1].tags).toHaveLength(1);
      expect(result[2].tags).toEqual([]);
    });

    it('should handle tasks with owners', () => {
      const mockPipeline: PipelineTestData = {
        id: 'test-id',
        tasks: [
          {
            name: 'task1',
            fullyQualifiedName: 'pipeline.task1',
            owners: [
              {
                id: 'owner1',
                type: 'user',
                name: 'Owner 1',
                fullyQualifiedName: 'owner1',
              },
            ],
          },
        ],
      };

      const result = extractPipelineTasks(mockPipeline);

      expect(result[0].owners).toHaveLength(1);
      expect(result[0].owners?.[0].name).toBe('Owner 1');
      expect(result[0].tags).toEqual([]);
    });
  });
});
