/* eslint-disable max-len */
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
import {
  LabelType,
  Language,
  Metric,
  MetricGranularity,
  MetricType,
  State,
  TagSource,
  UnitOfMeasurement,
} from '../generated/entity/data/metric';

export const METRIC_DUMMY_DATA: Metric = {
  id: '60c367be-a3d0-492a-b7be-8e38c970e0a7',
  name: 'Engagement Rate',
  fullyQualifiedName: 'Engagement Rate',
  description:
    'The **Engagement Rate** measures how actively your audience is interacting with your content, usually in the form of likes, comments, and shares.\n\n$$latex\n\\text{Engagement Rate} = \\left( \\frac{\\text{Engagements (Likes, Comments, Shares)}}{\\text{Total Followers or Views}} \\right) \\times 100\n$$\n\n👆this is the basic formula used internally. You can follow this to reimplement it in a different language',
  metricExpression: {
    language: Language.Python,
    code: 'def calculate_engagement_rate(total_engagements, total_views):\n    if total_views <= 0:\n        raise ValueError("Total views or followers must be greater than 0.")\n    return (total_engagements / total_views) * 100\n',
  },
  metricType: MetricType.Percentage,
  unitOfMeasurement: UnitOfMeasurement.Percentage,
  granularity: MetricGranularity.Year,
  relatedMetrics: [
    {
      id: 'aa80b81d-c033-4cb4-b00c-3adbf6ec5cd5',
      type: 'metric',
      name: 'Conversion Rate',
      fullyQualifiedName: 'Conversion Rate',
      displayName: 'Conversion Rate',
      deleted: false,
    },
    {
      id: '0b50f3d1-d906-4027-b687-f533b19aadce',
      type: 'metric',
      name: 'Gross Profit Margin',
      fullyQualifiedName: 'Gross Profit Margin',
      displayName: 'Gross Profit Margin',
      deleted: false,
    },
  ],
  version: 0.6,
  owners: [
    {
      id: 'ab85a6ee-379a-4d44-8fa6-beddbd158809',
      type: 'team',
      name: 'Marketing',
      fullyQualifiedName: 'Marketing',
      description: '',
      displayName: 'Marketing',
      deleted: false,
    },
  ],
  followers: [],
  tags: [
    {
      tagFQN: 'Customer Success.Annual Business Review',
      name: 'Annual Business Review',
      displayName: 'Annual Business Review (ABR)',
      description: 'Annual Business Review',
      style: {},
      source: TagSource.Glossary,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
    {
      tagFQN: 'Tier.Tier2',
      name: 'Tier2',
      description:
        '**Important business datasets for your company (not as critical as Tier 1)**\n\n- Used in important business metrics, product metrics, and dashboards to drive internal decisions\n\n- Used in important compliance reporting to major regulators, govt entities, and third party\n\n- Used for less critical online user-facing experiences (user activity, user behavior)\n\n- Source used to derive other critical Tier-2 datasets',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  ],
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'granularity',
        oldValue: 'QUARTER',
        newValue: 'YEAR',
      },
    ],
    fieldsDeleted: [],
    previousVersion: 0.5,
  },
  deleted: false,
  domain: {
    id: '635cf2af-5175-44e4-91f1-030beab290d5',
    type: 'domain',
    name: 'Marketing',
    fullyQualifiedName: 'Marketing',
    description: 'Marketing',
    displayName: 'Marketing',
  },
  dataProducts: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};
