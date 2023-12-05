/*
 *  Copyright 2023 Collate.
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
import { mockTableData } from '../mocks/TableVersion.mock';
import { getEntityTableName, getTaskMessage } from './TasksUtils';

describe('Tests for DataAssetsHeaderUtils', () => {
  it('function getEntityTableName should return name if no data found', () => {
    const entityName = getEntityTableName(
      EntityType.TABLE,
      'data_test_id',
      mockTableData
    );

    expect(entityName).toEqual('data_test_id');
  });

  it('function getEntityTableName should return name if it contains dot in it name', () => {
    const entityName = getEntityTableName(
      EntityType.TABLE,
      'data.test_id',
      mockTableData
    );

    expect(entityName).toEqual('data.test_id');
  });

  it('function getEntityTableName should return name if entity type not found', () => {
    const entityName = getEntityTableName(
      EntityType.DATABASE_SERVICE,
      'cyber_test',
      mockTableData
    );

    expect(entityName).toEqual('cyber_test');
  });

  it('function getEntityTableName should return entity display name for all entities', () => {
    const entityTableName = getEntityTableName(
      EntityType.TABLE,
      'shop_id',
      mockTableData
    );

    expect(entityTableName).toEqual('Shop Id Customer');
  });
});

const taskTagMessage = {
  value: null,
  entityType: EntityType.TABLE,
  entityData: mockTableData,
  field: null,
  startMessage: 'Request Tag',
};

const taskDescriptionMessage = {
  ...taskTagMessage,
  startMessage: 'Request Description',
};

describe('Tests for getTaskMessage', () => {
  it('function getTaskMessage should return task message for tags', () => {
    // entity request task message
    const requestTagsEntityMessage = getTaskMessage(taskTagMessage);

    expect(requestTagsEntityMessage).toEqual(
      'Request Tag for table raw_product_catalog '
    );

    // entity request column message
    const requestTagsEntityColumnMessage = getTaskMessage({
      ...taskTagMessage,
      value: 'order_id',
      field: 'columns',
    });

    expect(requestTagsEntityColumnMessage).toEqual(
      'Request Tag for table raw_product_catalog columns/order_id'
    );

    // entity update task message
    const updateTagsEntityMessage = getTaskMessage({
      ...taskTagMessage,
      startMessage: 'Update Tag',
    });

    expect(updateTagsEntityMessage).toEqual(
      'Update Tag for table raw_product_catalog '
    );

    // entity update column message
    const updateTagsEntityColumnMessage = getTaskMessage({
      ...taskTagMessage,
      value: 'order_id',
      field: 'columns',
      startMessage: 'Update Tag',
    });

    expect(updateTagsEntityColumnMessage).toEqual(
      'Update Tag for table raw_product_catalog columns/order_id'
    );
  });

  it('function getTaskMessage should return task message for description', () => {
    // entity request task message
    const requestDescriptionEntityMessage = getTaskMessage(
      taskDescriptionMessage
    );

    expect(requestDescriptionEntityMessage).toEqual(
      'Request Description for table raw_product_catalog '
    );

    // entity request column message
    const requestDescriptionEntityColumnMessage = getTaskMessage({
      ...taskDescriptionMessage,
      value: 'order_id',
      field: 'columns',
    });

    expect(requestDescriptionEntityColumnMessage).toEqual(
      'Request Description for table raw_product_catalog columns/order_id'
    );

    // entity update task message
    const updateDescriptionEntityMessage = getTaskMessage({
      ...taskDescriptionMessage,
      startMessage: 'Update Description',
    });

    expect(updateDescriptionEntityMessage).toEqual(
      'Update Description for table raw_product_catalog '
    );

    // entity update column message
    const updateDescriptionEntityColumnMessage = getTaskMessage({
      ...taskDescriptionMessage,
      value: 'order_id',
      field: 'columns',
      startMessage: 'Update Description',
    });

    expect(updateDescriptionEntityColumnMessage).toEqual(
      'Update Description for table raw_product_catalog columns/order_id'
    );
  });
});
