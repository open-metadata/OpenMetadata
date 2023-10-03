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
import { DataInsightChartType } from '../generated/dataInsight/dataInsightChartResult';
import { getGraphDataByEntityType } from './DataInsightUtils';
const mockEntityDescriptionData = [
  {
    timestamp: 1693872000000,
    entityType: 'Table',
    completedDescriptionFraction: 0.11,
    completedDescription: 11,
    entityCount: 100,
  },
];
const mockServiceDescriptionData = [
  {
    timestamp: 1693872000000,
    serviceName: 'mySQL',
    hasOwnerFraction: 0.056179775280898875,
    hasOwner: 5,
    entityCount: 89,
  },
];

const mockEntityOwnerData = [
  {
    timestamp: 1693872000000,
    entityType: 'Table',
    hasOwnerFraction: 0.08,
    hasOwner: 8,
    entityCount: 100,
  },
];
const mockServiceOwnerData = [
  {
    timestamp: 1693872000000,
    serviceName: 'mySQL',
    hasOwnerFraction: 0.056179775280898875,
    hasOwner: 5,
    entityCount: 89,
  },
];

describe('DataInsightUtils', () => {
  it('getGraphDataByEntityType fn should provide result for entity type graph', () => {
    const entityDescription = getGraphDataByEntityType(
      mockEntityDescriptionData,
      DataInsightChartType.PercentageOfEntitiesWithDescriptionByType
    );
    const entityOwner = getGraphDataByEntityType(
      mockEntityOwnerData,
      DataInsightChartType.PercentageOfEntitiesWithOwnerByType
    );

    expect(entityDescription).toStrictEqual({
      data: [
        {
          Table: 11,
          timestamp: 'Sep 05',
          timestampValue: 1693872000000,
        },
      ],
      entities: ['Table'],
      isPercentageGraph: true,
      latestData: {
        Table: 11,
        timestamp: 'Sep 05',
        timestampValue: 1693872000000,
      },
      relativePercentage: 0,
      total: '11.00',
    });
    expect(entityOwner).toStrictEqual({
      data: [
        {
          Table: 8,
          timestamp: 'Sep 05',
          timestampValue: 1693872000000,
        },
      ],
      entities: ['Table'],
      isPercentageGraph: true,
      latestData: {
        Table: 8,
        timestamp: 'Sep 05',
        timestampValue: 1693872000000,
      },
      relativePercentage: 0,
      total: '8.00',
    });
  });

  it('getGraphDataByEntityType fn should provide result for service type graph', () => {
    const serviceDescription = getGraphDataByEntityType(
      mockServiceDescriptionData,
      DataInsightChartType.PercentageOfServicesWithDescription
    );
    const serviceOwner = getGraphDataByEntityType(
      mockServiceOwnerData,
      DataInsightChartType.PercentageOfServicesWithOwner
    );

    expect(serviceDescription).toStrictEqual({
      data: [
        {
          mySQL: 0,
          timestamp: 'Sep 05',
          timestampValue: 1693872000000,
        },
      ],
      entities: ['mySQL'],
      isPercentageGraph: true,
      latestData: {
        mySQL: 0,
        timestamp: 'Sep 05',
        timestampValue: 1693872000000,
      },
      relativePercentage: 0,
      total: '0.00',
    });
    expect(serviceOwner).toStrictEqual({
      data: [
        {
          mySQL: 5.617977528089887,
          timestamp: 'Sep 05',
          timestampValue: 1693872000000,
        },
      ],
      entities: ['mySQL'],
      isPercentageGraph: true,
      latestData: {
        mySQL: 5.617977528089887,
        timestamp: 'Sep 05',
        timestampValue: 1693872000000,
      },
      relativePercentage: 0,
      total: '5.62',
    });
  });
});
