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
import { ApiEndpointClass } from '../support/entity/ApiEndpointClass';
import { DashboardDataModelClass } from '../support/entity/DashboardDataModelClass';
import { FileClass } from '../support/entity/FileClass';
import { SearchIndexClass } from '../support/entity/SearchIndexClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { WorksheetClass } from '../support/entity/WorksheetClass';

export const nestedChildrenTestData: Record<
  string,
  {
    CreationClass:
      | typeof ApiEndpointClass
      | typeof DashboardDataModelClass
      | typeof FileClass
      | typeof SearchIndexClass
      | typeof TableClass
      | typeof TopicClass
      | typeof WorksheetClass;
    tabSelector?: string;
    supportDisplayNameUpdate?: boolean;
  }
> = {
  'API Endpoint': {
    CreationClass: ApiEndpointClass,
  },
  'Data Model': {
    CreationClass: DashboardDataModelClass,
    supportDisplayNameUpdate: true,
  },
  File: {
    CreationClass: FileClass,
    tabSelector: '.ant-tabs-nav-list [data-node-key="schema"]',
  },
  'Search Index': {
    CreationClass: SearchIndexClass,
  },
  Table: {
    CreationClass: TableClass,
    supportDisplayNameUpdate: true,
  },
  Topic: {
    CreationClass: TopicClass,
  },
  Worksheet: {
    CreationClass: WorksheetClass,
  },
};
