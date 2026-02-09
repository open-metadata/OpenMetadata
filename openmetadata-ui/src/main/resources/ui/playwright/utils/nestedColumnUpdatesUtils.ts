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
import { nestedChildrenTestData } from '../constant/nestedColumnUpdates';
import { ApiEndpointClass } from '../support/entity/ApiEndpointClass';
import { DashboardDataModelClass } from '../support/entity/DashboardDataModelClass';
import { FileClass } from '../support/entity/FileClass';
import { SearchIndexClass } from '../support/entity/SearchIndexClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';

type EntityTypes = InstanceType<
  typeof nestedChildrenTestData[keyof typeof nestedChildrenTestData]['CreationClass']
>;

export const getNestedColumnDetails = (type: string, data: EntityTypes) => {
  const fqn = data.entityResponseData.fullyQualifiedName;

  switch (type) {
    case 'API Endpoint': {
      const entity = data as ApiEndpointClass;
      const level0Key = `${fqn}.requestSchema.${entity.children?.[0].name}`;
      const level1Key = `${level0Key}.${entity.children?.[0].children?.[0].name}`;
      const level2Key = `${level1Key}.${entity.children?.[0].children?.[0].children?.[0].name}`;
      return {
        level0Key,
        level1Key,
        level2Key,
        expand: true,
      };
    }
    case 'Topic': {
      const entity = data as TopicClass;
      const level0Key = `${entity.children?.[0].name}`;
      const level1Key = `${entity.children?.[0].children?.[0].name}`;
      const level2Key = `${entity.children?.[0].children?.[0].children?.[0].name}`;
      return {
        level0Key,
        level1Key,
        level2Key,
        expand: false,
      };
    }
    case 'Data Model': {
      const entity = data as DashboardDataModelClass;

      const level0Key = `${entity.children?.[1].name}`;
      const level1Key = `${entity.children?.[1].children?.[0].name}`;
      const level2Key = `${entity.children?.[1].children?.[0].children?.[0].name}`;
      return {
        level0Key,
        level1Key,
        level2Key,
        expand: true,
      };
    }
    case 'File':
    case 'Worksheet': {
      const entity = data as FileClass;

      const level0Key = `${fqn}.${entity.children?.[1].name}`;
      const level1Key = `${level0Key}.${entity.children?.[1].children?.[0].name}`;
      const level2Key = `${level1Key}.${entity.children?.[1].children?.[0].children?.[0].name}`;
      return {
        level0Key,
        level1Key,
        level2Key,
        expand: true,
      };
    }
    case 'Search Index': {
      const entity = data as SearchIndexClass;

      const level0Key = `${fqn}.${entity.children?.[3].name}`;
      const level1Key = `${level0Key}.${entity.children?.[3].children?.[0].name}`;
      const level2Key = `${level1Key}.${entity.children?.[3].children?.[0].children?.[0].name}`;
      return {
        level0Key,
        level1Key,
        level2Key,
        expand: true,
      };
    }
    case 'Table': {
      const entity = data as TableClass;

      const level0Key = `${fqn}.${entity.children?.[2].name}`;
      const level1Key = `${level0Key}.${entity.children?.[2].children?.[1].name}`;
      const level2Key = `${level1Key}.${entity.children?.[2].children?.[1].children?.[0].name}`;
      return {
        level0Key,
        level1Key,
        level2Key,
        expand: false,
      };
    }
    default:
      return { level0Key: '', level1Key: '', level2Key: '', expand: true };
  }
};
