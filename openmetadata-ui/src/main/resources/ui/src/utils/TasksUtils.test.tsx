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

import { act } from '@testing-library/react';
import { EntityType } from '../enums/entity.enum';
import { Glossary } from '../generated/entity/data/glossary';
import { mockTableData } from '../mocks/TableVersion.mock';
import { MOCK_ASSIGNEE_DATA } from '../mocks/Task.mock';
import { getUserAndTeamSearch } from '../rest/miscAPI';
import {
  fetchOptions,
  getEntityTableName,
  getTaskAssignee,
  getTaskEntityFQN,
  getTaskMessage,
} from './TasksUtils';

jest.mock('../rest/miscAPI', () => ({
  getUserAndTeamSearch: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_ASSIGNEE_DATA)),
}));

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

describe('Tests for fetchOptions', () => {
  it('function fetchOptions should trigger setOptions without filtered options', async () => {
    const mockSetOptions = jest.fn();

    (getUserAndTeamSearch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(MOCK_ASSIGNEE_DATA)
    );

    await act(async () => {
      fetchOptions({ query: 'test_user', setOptions: mockSetOptions });
    });

    expect(mockSetOptions).toHaveBeenCalledWith([
      {
        label: 'Ashish Gupta',
        displayName: 'Ashish Gupta',
        name: 'ashish',
        type: 'user',
        value: '18ca6cd1-d696-4a22-813f-c7a42fc09dc4',
      },
      {
        displayName: 'Ashley King',
        label: 'Ashley King',
        name: 'ashley_king5',
        type: 'user',
        value: '0c83a592-7ced-4156-b235-01726259a0e7',
      },
    ]);
  });

  it('function fetchOptions should trigger setOptions with filtered options', async () => {
    const mockSetOptions = jest.fn();

    (getUserAndTeamSearch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(MOCK_ASSIGNEE_DATA)
    );

    await act(async () => {
      fetchOptions({
        query: 'test_user',
        setOptions: mockSetOptions,
        currentUserId: '18ca6cd1-d696-4a22-813f-c7a42fc09dc4',
      });
    });

    expect(mockSetOptions).toHaveBeenCalledWith([
      {
        displayName: 'Ashley King',
        label: 'Ashley King',
        name: 'ashley_king5',
        type: 'user',
        value: '0c83a592-7ced-4156-b235-01726259a0e7',
      },
    ]);
  });
});

describe('Tests for getTaskAssignee', () => {
  it('should return empty data is no owner and reviewer', async () => {
    const response = getTaskAssignee({} as Glossary);

    expect(response).toEqual([]);
  });

  it('should return owner data if no reviewer present', async () => {
    const response = getTaskAssignee({
      owners: [
        {
          deleted: false,
          displayName: 'David',
          fullyQualifiedName: 'david',
          href: 'http://localhost:8585/api/v1/users/5e08061e-4cf2-46d0-93e3-2f0cc38844db',
          id: '5e08061e-4cf2-46d0-93e3-2f0cc38844db',
          name: 'david',
          type: 'user',
        },
      ],
    } as Glossary);

    expect(response).toEqual([
      {
        label: 'David',
        name: 'david',
        type: 'user',
        value: '5e08061e-4cf2-46d0-93e3-2f0cc38844db',
      },
    ]);
  });

  it('should return reviewer data if present', async () => {
    const response = getTaskAssignee({
      reviewers: [
        {
          deleted: false,
          displayName: 'Rolex',
          fullyQualifiedName: 'rolex',
          href: 'http://localhost:8585/api/v1/users/aa1eee18-5468-40f8-9ddc-e73f6fb9917f',
          id: 'aa1eee18-5468-40f8-9ddc-e73f6fb9917f',
          name: 'rolex',
          type: 'user',
        },
      ],
      owners: [
        {
          deleted: false,
          displayName: 'David',
          fullyQualifiedName: 'david',
          href: 'http://localhost:8585/api/v1/users/5e08061e-4cf2-46d0-93e3-2f0cc38844db',
          id: '5e08061e-4cf2-46d0-93e3-2f0cc38844db',
          name: 'david',
          type: 'user',
        },
      ],
    } as Glossary);

    expect(response).toEqual([
      {
        label: 'Rolex',
        name: 'rolex',
        type: 'user',
        value: 'aa1eee18-5468-40f8-9ddc-e73f6fb9917f',
      },
    ]);
  });
});

describe('Tests for getTaskEntityFQN', () => {
  it('should return fqn for table entity', async () => {
    const fqn = 'sample_data.ecommerce_db.shopify."dim.product"';
    const response = getTaskEntityFQN(EntityType.TABLE, fqn);

    expect(response).toEqual(fqn);
  });

  it('should return table fqn only when column name present in fqn', async () => {
    const response = getTaskEntityFQN(
      EntityType.TABLE,
      'sample_data.ecommerce_db.shopify."dim.product".address_id'
    );

    expect(response).toEqual('sample_data.ecommerce_db.shopify."dim.product"');
  });

  it('should return fqn as it is if entity type is not table', async () => {
    const fqn = 'sample_looker.customers';
    const response = getTaskEntityFQN(EntityType.DASHBOARD, fqn);

    expect(response).toEqual(fqn);
  });
});
