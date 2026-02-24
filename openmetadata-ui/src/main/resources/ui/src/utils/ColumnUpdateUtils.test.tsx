/*
 *  Copyright 2024 Collate.
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

import { EntityType } from '../enums/entity.enum';
import { APIEndpoint, Field } from '../generated/entity/data/apiEndpoint';
import { Container } from '../generated/entity/data/container';
import {
  Column as DataModelColumn,
  DashboardDataModel,
} from '../generated/entity/data/dashboardDataModel';
import { Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline } from '../generated/entity/data/pipeline';
import { SearchIndex } from '../generated/entity/data/searchIndex';
import { Column, Table } from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { TagLabel, TagSource } from '../generated/type/tagLabel';
import {
  handleColumnFieldUpdate,
  updateApiEndpointField,
  updateContainerColumn,
  updateDataModelColumn,
  updateMlModelFeature,
  updatePipelineTask,
  updateSearchIndexField,
  updateTableColumn,
  updateTopicField,
} from './ColumnUpdateUtils';
import type { EntityDataMapValue } from './ColumnUpdateUtils.interface';

// Mock dependencies
jest.mock('./TableUtils', () => {
  const actual = jest.requireActual('./TableUtils');

  return {
    ...actual,
    findFieldByFQN: jest.fn(
      (items: Array<{ fullyQualifiedName?: string }>, fqn: string) =>
        items.find((item) => item.fullyQualifiedName === fqn)
    ),
    normalizeTags: jest.fn((tags: TagLabel[]) => tags),
    pruneEmptyChildren: jest.fn((columns: Column[]) => columns),
  };
});
jest.mock('./ContainerDetailUtils', () => {
  const actual = jest.requireActual('./ContainerDetailUtils');

  return {
    ...actual,
  };
});

describe('ColumnUpdateUtils', () => {
  const mockColumnFQN = 'test.service.table.column1';
  const mockUpdate = {
    description: 'Updated description',
    tags: [
      {
        tagFQN: 'test.tag',
        source: TagSource.Classification,
      } as TagLabel,
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateTopicField', () => {
    it('should update topic field description', () => {
      const topic: Partial<Topic> = {
        name: 'test-topic',
        fullyQualifiedName: 'test.service.topic',
        messageSchema: {
          schemaFields: [
            {
              name: 'column1',
              fullyQualifiedName: mockColumnFQN,
              dataType: 'STRING' as Field['dataType'],
            } as Field,
          ],
        },
      };

      const result = updateTopicField(topic as Topic, mockColumnFQN, {
        description: 'New description',
      });

      expect(
        result.updatedTopic.messageSchema?.schemaFields?.[0].description
      ).toBe('New description');
      expect(result.updatedColumn).toBeDefined();
    });

    it('should update topic field tags', () => {
      const topic: Partial<Topic> = {
        name: 'test-topic',
        fullyQualifiedName: 'test.service.topic',
        messageSchema: {
          schemaFields: [
            {
              name: 'column1',
              fullyQualifiedName: mockColumnFQN,
              dataType: 'STRING' as Field['dataType'],
            } as Field,
          ],
        },
      };

      const result = updateTopicField(topic as Topic, mockColumnFQN, {
        tags: mockUpdate.tags,
      });

      expect(result.updatedTopic).toBeDefined();
      expect(result.updatedColumn).toBeDefined();
    });
  });

  describe('updateSearchIndexField', () => {
    it('should update search index field description', () => {
      const searchIndex: Partial<SearchIndex> = {
        name: 'test-index',
        fullyQualifiedName: 'test.service.index',
        fields: [
          {
            name: 'field1',
            fullyQualifiedName: mockColumnFQN,
            dataType: 'STRING' as SearchIndex['fields'][0]['dataType'],
          },
        ],
      };

      const result = updateSearchIndexField(
        searchIndex as SearchIndex,
        mockColumnFQN,
        {
          description: 'New description',
        }
      );

      expect(result.updatedSearchIndex).toBeDefined();
      expect(result.updatedColumn).toBeDefined();
    });
  });

  describe('updateContainerColumn', () => {
    it('should update container column description', () => {
      const container: Partial<Container> = {
        name: 'test-container',
        fullyQualifiedName: 'test.service.container',
        dataModel: {
          columns: [
            {
              name: 'column1',
              fullyQualifiedName: mockColumnFQN,
              dataType: 'STRING' as Column['dataType'],
            } as Column,
          ],
        },
      };

      const result = updateContainerColumn(
        container as Container,
        mockColumnFQN,
        {
          description: 'New description',
        }
      );

      expect(result.updatedContainer).toBeDefined();
      expect(result.updatedColumn).toBeDefined();
    });

    it('should return unchanged container if dataModel is missing', () => {
      const container: Partial<Container> = {
        name: 'test-container',
        fullyQualifiedName: 'test.service.container',
      };

      const result = updateContainerColumn(
        container as Container,
        mockColumnFQN,
        {
          description: 'New description',
        }
      );

      expect(result.updatedContainer).toEqual(container);
      expect(result.updatedColumn).toBeUndefined();
    });
  });

  describe('updateMlModelFeature', () => {
    it('should update ML model feature description', () => {
      const mlModel: Partial<Mlmodel> = {
        name: 'test-model',
        fullyQualifiedName: 'test.service.model',
        mlFeatures: [
          {
            name: 'feature1',
            fullyQualifiedName: mockColumnFQN,
          },
        ],
      };

      const result = updateMlModelFeature(mlModel as Mlmodel, mockColumnFQN, {
        description: 'New description',
      });

      expect(result.updatedMlModel.mlFeatures?.[0].description).toBe(
        'New description'
      );
      expect(result.updatedColumn).toBeDefined();
    });

    it('should update ML model feature tags', () => {
      const mlModel: Partial<Mlmodel> = {
        name: 'test-model',
        fullyQualifiedName: 'test.service.model',
        mlFeatures: [
          {
            name: 'feature1',
            fullyQualifiedName: mockColumnFQN,
          },
        ],
      };

      const result = updateMlModelFeature(mlModel as Mlmodel, mockColumnFQN, {
        tags: mockUpdate.tags,
      });

      expect(result.updatedMlModel.mlFeatures?.[0].tags).toBeDefined();
      expect(result.updatedColumn).toBeDefined();
    });
  });

  describe('updatePipelineTask', () => {
    it('should update pipeline task description', () => {
      const pipeline: Partial<Pipeline> = {
        name: 'test-pipeline',
        fullyQualifiedName: 'test.service.pipeline',
        tasks: [
          {
            name: 'task1',
            fullyQualifiedName: mockColumnFQN,
          },
        ],
      };

      const result = updatePipelineTask(pipeline as Pipeline, mockColumnFQN, {
        description: 'New description',
      });

      expect(result.updatedPipeline.tasks?.[0].description).toBe(
        'New description'
      );
      expect(result.updatedColumn).toBeDefined();
    });
  });

  describe('updateApiEndpointField', () => {
    it('should update API endpoint request schema field', () => {
      const apiEndpoint: Partial<APIEndpoint> = {
        name: 'test-endpoint',
        fullyQualifiedName: 'test.service.endpoint',
        requestSchema: {
          schemaFields: [
            {
              name: 'field1',
              fullyQualifiedName: mockColumnFQN,
              dataType: 'STRING' as Field['dataType'],
            } as Field,
          ],
        },
      };

      const result = updateApiEndpointField(
        apiEndpoint as APIEndpoint,
        mockColumnFQN,
        {
          description: 'New description',
        }
      );

      expect(result.updatedApiEndpoint).toBeDefined();
      expect(result.updatedColumn).toBeDefined();
    });

    it('should return unchanged endpoint if field not found', () => {
      const apiEndpoint: Partial<APIEndpoint> = {
        name: 'test-endpoint',
        fullyQualifiedName: 'test.service.endpoint',
      };

      const result = updateApiEndpointField(
        apiEndpoint as APIEndpoint,
        mockColumnFQN,
        {
          description: 'New description',
        }
      );

      expect(result.updatedApiEndpoint).toEqual(apiEndpoint);
      expect(result.updatedColumn).toBeUndefined();
    });
  });

  describe('updateTableColumn', () => {
    const mockTable: Partial<Table> = {
      id: 'test-table-id',
      name: 'test-table',
      fullyQualifiedName: 'test.service.table',
      columns: [
        {
          name: 'column1',
          fullyQualifiedName: mockColumnFQN,
          dataType: 'STRING' as Column['dataType'],
        } as Column,
      ],
    };

    it('should update table column description', () => {
      const result = updateTableColumn(mockTable as Table, mockColumnFQN, {
        description: 'New description',
      });

      expect(result.updatedTable).toBeDefined();
      expect(result.updatedColumn).toBeDefined();
      expect(result.updatedColumn?.description).toBe('New description');
    });

    it('should update table column tags', () => {
      const mockTags: TagLabel[] = [
        {
          tagFQN: 'test.tag',
          source: TagSource.Classification,
          labelType: 'Manual',
          state: 'Confirmed',
        } as TagLabel,
      ];

      const result = updateTableColumn(mockTable as Table, mockColumnFQN, {
        tags: mockTags,
      });

      expect(result.updatedTable).toBeDefined();
      expect(result.updatedColumn).toBeDefined();
      expect(result.updatedColumn?.tags).toEqual(mockTags);
    });
  });

  describe('updateDataModelColumn', () => {
    const mockDataModel: Partial<DashboardDataModel> = {
      name: 'test-model',
      fullyQualifiedName: 'test.service.model',
      columns: [
        {
          name: 'column1',
          fullyQualifiedName: mockColumnFQN,
          dataType: 'STRING' as DataModelColumn['dataType'],
        } as DataModelColumn,
      ],
    };

    it('should update data model column description', () => {
      const result = updateDataModelColumn(
        mockDataModel as DashboardDataModel,
        mockColumnFQN,
        {
          description: 'New description',
        }
      );

      expect(result.updatedDataModel).toBeDefined();
      expect(result.updatedColumn).toBeDefined();
      expect(result.updatedColumn?.description).toBe('New description');
    });

    it('should update data model column tags', () => {
      const mockTags: TagLabel[] = [
        {
          tagFQN: 'test.tag',
          source: TagSource.Classification,
          labelType: 'Manual',
          state: 'Confirmed',
        } as TagLabel,
      ];

      const result = updateDataModelColumn(
        mockDataModel as DashboardDataModel,
        mockColumnFQN,
        {
          tags: mockTags,
        }
      );

      expect(result.updatedDataModel).toBeDefined();
      expect(result.updatedColumn).toBeDefined();
      expect(result.updatedColumn?.tags).toEqual(mockTags);
    });
  });

  describe('handleColumnFieldUpdate', () => {
    it('should handle Topic entity type', async () => {
      const topic: Partial<Topic> = {
        name: 'test-topic',
        fullyQualifiedName: 'test.service.topic',
        messageSchema: {
          schemaFields: [
            {
              name: 'column1',
              fullyQualifiedName: mockColumnFQN,
              dataType: 'STRING' as Field['dataType'],
            } as Field,
          ],
        },
      };

      const result = await handleColumnFieldUpdate({
        entityType: EntityType.TOPIC,
        entityData: topic as Topic,
        fqn: mockColumnFQN,
        update: { description: 'New description' },
      });

      expect(result.updatedEntity).toBeDefined();
      expect(result.updatedColumn).toBeDefined();
    });

    it('should handle Table entity type', async () => {
      const table: Partial<Table> = {
        id: 'test-table-id',
        name: 'test-table',
        fullyQualifiedName: 'test.service.table',
        columns: [
          {
            name: 'column1',
            fullyQualifiedName: mockColumnFQN,
            dataType: 'STRING' as Column['dataType'],
          } as Column,
        ],
      };

      const result = handleColumnFieldUpdate({
        entityType: EntityType.TABLE,
        entityData: table as Table,
        fqn: mockColumnFQN,
        update: { description: 'New description' },
      });

      expect(result.updatedEntity).toBeDefined();
      expect(result.updatedColumn).toBeDefined();
    });

    it('should handle unknown entity type', () => {
      const result = handleColumnFieldUpdate({
        entityType: EntityType.DATABASE as EntityType,
        entityData: {} as EntityDataMapValue,
        fqn: mockColumnFQN,
        update: { description: 'New description' },
      });

      expect(result.updatedEntity).toEqual({});
      expect(result.updatedColumn).toBeUndefined();
    });
  });
});
