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

import { Document } from '../generated/entity/docStore/document';
import { Paging } from '../generated/type/paging';

export const mockWidgetsData: { data: Document[]; paging: Paging } = {
  data: [
    {
      id: '04fac073-d4a0-42b9-8be1-bf92b45c060b',
      name: 'ActivityFeed',
      displayName: 'Activity Feed',
      fullyQualifiedName: 'KnowledgePanel.ActivityFeed',
      description:
        'Activity Feed KnowledgePanel shows Activity Feed,Mentions and Tasks that are assigned to User.',
      entityType: 'KnowledgePanel',
      data: {
        gridSizes: ['large'],
      },
      updatedBy: 'admin',
    },
    {
      id: '5bf549a2-adc7-48be-8a61-17c08aeeaa1b',
      name: 'Following',
      displayName: 'Following',
      fullyQualifiedName: 'KnowledgePanel.Following',
      description:
        'Following KnowledgePanel shows all the Assets that the User is Following.',
      entityType: 'KnowledgePanel',
      data: {
        gridSizes: ['small'],
      },
      updatedBy: 'admin',
    },
    {
      id: 'f087d02c-c9ac-4986-800a-36da5074cc98',
      name: 'KPI',
      displayName: 'KPI',
      fullyQualifiedName: 'KnowledgePanel.KPI',
      description:
        "KPI KnowledgePanel shows the Organization's KPIs on description, owner coverage.",
      entityType: 'KnowledgePanel',
      data: {
        gridSizes: ['small', 'medium'],
      },
      updatedBy: 'admin',
    },
    {
      id: '3539996d-9980-4d3b-914b-0d3a2f18e09d',
      name: 'MyData',
      displayName: 'MyData',
      fullyQualifiedName: 'KnowledgePanel.MyData',
      description:
        "MyData KnowledgePanel shows the list of Assets that is owned by User or User's Team.",
      entityType: 'KnowledgePanel',
      data: {
        gridSizes: ['small'],
      },
      updatedBy: 'admin',
    },
    {
      id: 'd0f5f235-11bf-44d8-b215-0aa8def97d07',
      name: 'RecentlyViewed',
      displayName: 'Recently Viewed',
      fullyQualifiedName: 'KnowledgePanel.RecentlyViewed',
      description:
        'Recently Viewed KnowledgePanel shows list of Data Assets that User visited.',
      entityType: 'KnowledgePanel',
      data: {
        gridSizes: ['small'],
      },
      updatedBy: 'admin',
    },
    {
      id: 'bc0d4328-1ef3-4c33-9c79-1c618b18ea92',
      name: 'TotalAssets',
      displayName: 'Total Assets',
      fullyQualifiedName: 'KnowledgePanel.TotalAssets',
      description:
        'Total Assets KnowledgePanel shows Data Asset growth across the organization.',
      entityType: 'KnowledgePanel',
      data: {
        gridSizes: ['medium', 'large'],
      },
      updatedBy: 'admin',
    },
  ],
  paging: {
    total: 6,
  },
};
