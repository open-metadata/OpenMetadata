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
import {
  Chart,
  ChartType,
  DashboardServiceType,
  LabelType,
  State,
  TagSource,
} from '../generated/entity/data/chart';

export const MOCK_CHART_DATA: Chart = {
  id: 'f4464d71-f900-4f8c-aca1-b7b95cc077e1',
  name: '127',
  displayName: 'Are you an ethnic minority in your city?',
  fullyQualifiedName: 'sample_superset.127',
  description: '',
  version: 0.2,
  updatedAt: 1718702267352,
  updatedBy: 'admin',
  chartType: ChartType.Other,
  sourceUrl:
    'http://localhost:8088/superset/explore/?form_data=%7B%22slice_id%22%3A%20127%7D',
  followers: [],
  tags: [
    {
      tagFQN: 'Glossary.Glossary=Term',
      displayName: 'Glossary=Term',
      name: 'Glossary=Term',
      labelType: LabelType.Manual,
      description: 'Glossary=Term',
      style: {},
      source: TagSource.Glossary,
      state: State.Confirmed,
    },
  ],
  service: {
    deleted: false,
    displayName: 'sample_superset',
    name: 'sample_superset',
    id: 'f70b7a78-8327-4565-a069-6cac70fa99cf',
    type: 'dashboardService',
    fullyQualifiedName: 'sample_superset',
  },
  serviceType: DashboardServiceType.Superset,
  deleted: false,
  dataProducts: [],
  votes: {
    upVoters: [],
    downVoters: [],
    upVotes: 0,
    downVotes: 0,
  },
  dashboards: [
    {
      deleted: false,
      displayName: 'deck.gl Demo',
      name: '10',
      description: '',
      id: '77a0ac8a-ca1a-4f21-9a37-406faa482008',
      type: 'dashboard',
      fullyQualifiedName: 'sample_superset.10',
    },
    {
      deleted: false,
      displayName: 'Misc Charts',
      name: '12',
      description: '',
      id: '54e2f981-ba28-4393-b21b-f85a8b7e63e9',
      type: 'dashboard',
      fullyQualifiedName: 'sample_superset.12',
    },
    {
      deleted: false,
      displayName: 'Slack Dashboard',
      name: '33',
      description: '',
      id: '35e7b4db-9daa-4711-b4f0-a273fc966050',
      type: 'dashboard',
      fullyQualifiedName: 'sample_superset.33',
    },
    {
      deleted: false,
      displayName: 'Video Game Sales',
      name: '51',
      description: '',
      id: '135fdd19-471c-4edf-a226-066c54f2f889',
      type: 'dashboard',
      fullyQualifiedName: 'sample_superset.51',
    },
  ],
};
