/*
 *  Copyright 2022 Collate.
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
  ChartType,
  LabelType,
  State,
  TagSource,
} from '../generated/entity/data/chart';
import { DashboardServiceType } from '../generated/entity/data/dashboard';

export const mockCharts = [
  {
    id: '86dad1d4-8830-4d35-ab03-dd6190c1f05d',
    name: '127',
    displayName: 'Are you an ethnic minority in your city?',
    fullyQualifiedName: 'sample_superset.127',
    description: '',
    version: 3.5,
    updatedAt: 1669804896748,
    updatedBy: 'admin',
    chartType: ChartType.Other,
    chartUrl:
      'http://localhost:8088/superset/explore/?form_data=%7B%22slice_id%22%3A%20127%7D',
    href: 'http://localhost:8585/api/v1/charts/86dad1d4-8830-4d35-ab03-dd6190c1f05d',
    tags: [
      {
        tagFQN: 'PII.NonSensitive',
        description:
          'PII which is easily accessible from public sources and can include zip code, race, gender, and date of birth.',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'PersonalData.Personal',
        description:
          'Data that can be used to directly or indirectly identify a person.',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'ab.tag',
        description: '',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'persona.tag',
        description: '',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'aa.tag',
        description: '',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'ac.tag',
        description: '',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
    ],
    service: {
      id: '1c7d6a14-69fe-4ee6-be3c-e6ff01c04055',
      type: 'dashboardService',
      name: 'sample_superset',
      fullyQualifiedName: 'sample_superset',
      deleted: false,
      href: 'http://localhost:8585/api/v1/services/dashboardServices/1c7d6a14-69fe-4ee6-be3c-e6ff01c04055',
    },
    serviceType: DashboardServiceType.Superset,
    changeDescription: {
      fieldsAdded: [
        {
          name: 'tags',
          newValue: '',
        },
      ],
      fieldsUpdated: [],
      fieldsDeleted: [],
      previousVersion: 3.4,
    },
    deleted: false,
  },
];

export const sortedTagsMockCharts = [
  {
    id: '86dad1d4-8830-4d35-ab03-dd6190c1f05d',
    name: '127',
    displayName: 'Are you an ethnic minority in your city?',
    fullyQualifiedName: 'sample_superset.127',
    description: '',
    version: 3.5,
    updatedAt: 1669804896748,
    updatedBy: 'admin',
    chartType: ChartType.Other,
    chartUrl:
      'http://localhost:8088/superset/explore/?form_data=%7B%22slice_id%22%3A%20127%7D',
    href: 'http://localhost:8585/api/v1/charts/86dad1d4-8830-4d35-ab03-dd6190c1f05d',
    tags: [
      {
        tagFQN: 'aa.tag',
        description: '',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'ab.tag',
        description: '',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'ac.tag',
        description: '',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'persona.tag',
        description: '',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'PersonalData.Personal',
        description:
          'Data that can be used to directly or indirectly identify a person.',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
      {
        tagFQN: 'PII.NonSensitive',
        description:
          'PII which is easily accessible from public sources and can include zip code, race, gender, and date of birth.',
        source: TagSource.Tag,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
    ],
    service: {
      id: '1c7d6a14-69fe-4ee6-be3c-e6ff01c04055',
      type: 'dashboardService',
      name: 'sample_superset',
      fullyQualifiedName: 'sample_superset',
      deleted: false,
      href: 'http://localhost:8585/api/v1/services/dashboardServices/1c7d6a14-69fe-4ee6-be3c-e6ff01c04055',
    },
    serviceType: DashboardServiceType.Superset,
    changeDescription: {
      fieldsAdded: [
        {
          name: 'tags',
          newValue: '',
        },
      ],
      fieldsUpdated: [],
      fieldsDeleted: [],
      previousVersion: 3.4,
    },
    deleted: false,
  },
];
