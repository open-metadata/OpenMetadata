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

import { getFormattedDateFromMilliSeconds } from '../../utils/TimeUtils';

export const PIE_DATA = [
  { name: 'Tables', value: 40 },
  { name: 'Topics', value: 30 },
  { name: 'Dashboards', value: 30 },
  { name: 'Pipelines', value: 20 },
];

export const COLORS = ['#8884d8', '#82ca9d', '#9cc5e9', '#e99c9c'];

export const TEAM_FILTER = [
  {
    value: 'team1',
    label: 'Cloud Infra',
  },
  {
    value: 'team2',
    label: 'Payment',
  },
  {
    value: 'team3',
    label: 'OM Team',
  },
];

export const OVERVIEW = [
  {
    entityType: 'All',
    count: 657,
  },
  {
    entityType: 'Users',
    count: 45,
  },
  {
    entityType: 'Sessions',
    count: 657,
  },
  {
    entityType: 'Activity',
    count: 157,
  },
  {
    entityType: 'ActiveUsers',
    count: 33,
  },
  {
    entityType: 'Tables',
    count: 479,
  },
  {
    entityType: 'Topics',
    count: 11,
  },
  {
    entityType: 'Dashboards',
    count: 36,
  },
  {
    entityType: 'MlModels',
    count: 4,
  },
  {
    entityType: 'TestCases',
    count: 98,
  },
];

export const ENTITY_DESCRIPTION = [
  {
    timestamp: 1666862122147,
    entityType: 'Table',
    completedDescriptionFraction: 0.5674,
  },
  {
    timestamp: 1666862122147,
    entityType: 'Topic',
    completedDescriptionFraction: 0.0453,
  },
  {
    timestamp: 1666862122147,
    entityType: 'Database',
    completedDescriptionFraction: 0.9874,
  },
  {
    timestamp: 1666862122147,
    entityType: 'Pipeline',
    completedDescriptionFraction: 0.5432,
  },
  {
    timestamp: 1666862122147,
    entityType: 'Messaging',
    completedDescriptionFraction: 0.3215,
  },
  {
    timestamp: 1666689322147,
    entityType: 'Table',
    completedDescriptionFraction: 0.3674,
  },
  {
    timestamp: 1666689322147,
    entityType: 'Topic',
    completedDescriptionFraction: 0.0353,
  },
  {
    timestamp: 1666689322147,
    entityType: 'Database',
    completedDescriptionFraction: 0.9874,
  },
  {
    timestamp: 1666689322147,
    entityType: 'Pipeline',
    completedDescriptionFraction: 0.4432,
  },
  {
    timestamp: 1666689322147,
    entityType: 'Messaging',
    completedDescriptionFraction: 0.3115,
  },
  {
    timestamp: 1666602922147,
    entityType: 'Table',
    completedDescriptionFraction: 0.3374,
  },
  {
    timestamp: 1666602922147,
    entityType: 'Topic',
    completedDescriptionFraction: 0.0353,
  },
  {
    timestamp: 1666602922147,
    entityType: 'Database',
    completedDescriptionFraction: 0.9774,
  },
  {
    timestamp: 1666602922147,
    entityType: 'Pipeline',
    completedDescriptionFraction: 0.4482,
  },
  {
    timestamp: 1666602922147,
    entityType: 'Messaging',
    completedDescriptionFraction: 0.3105,
  },
];

export const ENTITY_OWNERS = [
  {
    timestamp: 1666862122147,
    entityType: 'Table',
    hasOwnerFraction: 0.5674,
  },
  {
    timestamp: 1666862122147,
    entityType: 'Topic',
    hasOwnerFraction: 0.0453,
  },
  {
    timestamp: 1666862122147,
    entityType: 'Database',
    hasOwnerFraction: 0.9874,
  },
  {
    timestamp: 1666862122147,
    entityType: 'Pipeline',
    hasOwnerFraction: 0.5432,
  },
  {
    timestamp: 1666862122147,
    entityType: 'Messaging',
    hasOwnerFraction: 0.3215,
  },
  {
    timestamp: 1666689322147,
    entityType: 'Table',
    hasOwnerFraction: 0.3674,
  },
  {
    timestamp: 1666689322147,
    entityType: 'Topic',
    hasOwnerFraction: 0.0353,
  },
  {
    timestamp: 1666689322147,
    entityType: 'Database',
    hasOwnerFraction: 0.9874,
  },
  {
    timestamp: 1666689322147,
    entityType: 'Pipeline',
    hasOwnerFraction: 0.4432,
  },
  {
    timestamp: 1666689322147,
    entityType: 'Messaging',
    hasOwnerFraction: 0.3115,
  },
  {
    timestamp: 1666602922147,
    entityType: 'Table',
    hasOwnerFraction: 0.3374,
  },
  {
    timestamp: 1666602922147,
    entityType: 'Topic',
    hasOwnerFraction: 0.0353,
  },
  {
    timestamp: 1666602922147,
    entityType: 'Database',
    hasOwnerFraction: 0.9774,
  },
  {
    timestamp: 1666602922147,
    entityType: 'Pipeline',
    hasOwnerFraction: 0.4482,
  },
  {
    timestamp: 1666602922147,
    entityType: 'Messaging',
    hasOwnerFraction: 0.3105,
  },
];

export const ENTITY_TIER = [
  {
    timestamp: 1666862122147,
    entityTier: 'Tier.Tier1',
    entityCount: 56,
  },
  {
    timestamp: 1666862122147,
    entityTier: 'Tier.Tier2',
    entityCount: 47,
  },
  {
    timestamp: 1666862122147,
    entityTier: 'Tier.Tier3',
    entityCount: 78,
  },
  {
    timestamp: 1666862122147,
    entityTier: null,
    entityCount: 101,
  },
  {
    timestamp: 1666689322147,
    entityTier: 'Tier.Tier1',
    entityCount: 51,
  },
  {
    timestamp: 1666689322147,
    entityTier: 'Tier.Tier2',
    entityCount: 47,
  },
  {
    timestamp: 1666689322147,
    entityTier: 'Tier.Tier3',
    entityCount: 78,
  },
  {
    timestamp: 1666689322147,
    entityTier: null,
    entityCount: 154,
  },
  {
    timestamp: 1666602922147,
    entityTier: 'Tier.Tier1',
    entityCount: 45,
  },
  {
    timestamp: 1666602922147,
    entityTier: 'Tier.Tier2',
    entityCount: 55,
  },
  {
    timestamp: 1666602922147,
    entityTier: 'Tier.Tier3',
    entityCount: 99,
  },
  {
    timestamp: 1666602922147,
    entityTier: null,
    entityCount: 162,
  },
];

export const ENTITY_COUNT = [
  {
    timestamp: 1666862122147,
    Type: 'Table',
    entityCount: 56,
  },
  {
    timestamp: 1666862122147,
    Type: 'Pipeline',
    entityCount: 47,
  },
  {
    timestamp: 1666862122147,
    Type: 'Dashboard',
    entityCount: 78,
  },
  {
    timestamp: 1666862122147,
    Type: 'Chart',
    entityCount: 101,
  },
  {
    timestamp: 1666862122147,
    Type: 'Messaging',
    entityCount: 101,
  },
  {
    timestamp: 1666689322147,
    Type: 'Table',
    entityCount: 51,
  },
  {
    timestamp: 1666689322147,
    Type: 'Pipeline',
    entityCount: 47,
  },
  {
    timestamp: 1666689322147,
    Type: 'Dashboard',
    entityCount: 78,
  },
  {
    timestamp: 1666689322147,
    Type: 'Topic',
    entityCount: 78,
  },
  {
    timestamp: 1666689322147,
    Type: 'Chart',
    entityCount: 154,
  },
  {
    timestamp: 1666602922147,
    Type: 'Table',
    entityCount: 45,
  },
  {
    timestamp: 1666602922147,
    Type: 'Pipeline',
    entityCount: 55,
  },
  {
    timestamp: 1666602922147,
    Type: 'Dashboard',
    entityCount: 99,
  },
  {
    timestamp: 1666602922147,
    Type: 'Chart',
    entityCount: 162,
  },
];

export const TOP_VIEW_ENTITIES = [
  {
    entityName: 'foo.bar.entity',
    owner: 'Aaron Smith',
    tags: ['Tag', 'AnotherTag'],
    entityType: 'Table',
    totalViews: 156,
    uniqueViews: 101,
  },
  {
    entityName: 'foo.bar.entity',
    owner: 'Aaron Smith',
    tags: ['Tag', 'AnotherTag'],
    entityType: 'Table',
    totalViews: 156,
    uniqueViews: 101,
  },
  {
    entityName: 'foo.bar.entity',
    owner: 'Aaron Smith',
    tags: ['Tag', 'AnotherTag'],
    entityType: 'Table',
    totalViews: 156,
    uniqueViews: 101,
  },
  {
    entityName: 'foo.bar.entity',
    owner: 'Aaron Smith',
    tags: ['Tag', 'AnotherTag'],
    entityType: 'Table',
    totalViews: 156,
    uniqueViews: 101,
  },
  {
    entityName: 'foo.bar.entity',
    owner: 'Aaron Smith',
    tags: ['Tag', 'AnotherTag'],
    entityType: 'Table',
    totalViews: 156,
    uniqueViews: 101,
  },
];

export const TOP_ACTIVE_USER = [
  {
    userName: 'AaronSmith',
    Team: 'Marketing',
    mostRecentSession: 1666862122147,
    totalSessions: 134,
    avgSessionDuration: 22.65,
  },
  {
    userName: 'AaronSmith',
    Team: 'Marketing',
    mostRecentSession: 1666862122147,
    totalSessions: 134,
    avgSessionDuration: 22.65,
  },
  {
    userName: 'AaronSmith',
    Team: 'Marketing',
    mostRecentSession: 1666862122147,
    totalSessions: 134,
    avgSessionDuration: 22.65,
  },
  {
    userName: 'AaronSmith',
    Team: 'Marketing',
    mostRecentSession: 1666862122147,
    totalSessions: 134,
    avgSessionDuration: 22.65,
  },
  {
    userName: 'AaronSmith',
    Team: 'Marketing',
    mostRecentSession: 1666862122147,
    totalSessions: 134,
    avgSessionDuration: 22.65,
  },
];

export const getEntityCountData = () => {
  const entities: string[] = [];
  const timestamps: string[] = [];

  const data = ENTITY_COUNT.map((data) => {
    const timestamp = getFormattedDateFromMilliSeconds(data.timestamp);
    if (!entities.includes(data.Type)) {
      entities.push(data.Type);
    }

    if (!timestamps.includes(timestamp)) {
      timestamps.push(timestamp);
    }

    return {
      timestamp: timestamp,
      [data.Type]: data.entityCount,
    };
  });

  const graphData = timestamps.map((timestamp) => {
    return data.reduce((previous, current) => {
      if (current.timestamp === timestamp) {
        return { ...previous, ...current };
      }

      return previous;
    }, {});
  });

  return { data: graphData, entities };
};

export const getEntityDescriptionData = () => {
  const entities: string[] = [];
  const timestamps: string[] = [];

  const data = ENTITY_DESCRIPTION.map((data) => {
    const timestamp = getFormattedDateFromMilliSeconds(data.timestamp);
    if (!entities.includes(data.entityType)) {
      entities.push(data.entityType);
    }

    if (!timestamps.includes(timestamp)) {
      timestamps.push(timestamp);
    }

    return {
      timestamp: timestamp,
      [data.entityType]: data.completedDescriptionFraction,
    };
  });

  const graphData = timestamps.map((timestamp) => {
    return data.reduce((previous, current) => {
      if (current.timestamp === timestamp) {
        return { ...previous, ...current };
      }

      return previous;
    }, {});
  });

  return { data: graphData, entities };
};

export const getEntityOwnersData = () => {
  const entities: string[] = [];
  const timestamps: string[] = [];

  const data = ENTITY_OWNERS.map((data) => {
    const timestamp = getFormattedDateFromMilliSeconds(data.timestamp);
    if (!entities.includes(data.entityType)) {
      entities.push(data.entityType);
    }

    if (!timestamps.includes(timestamp)) {
      timestamps.push(timestamp);
    }

    return {
      timestamp: timestamp,
      [data.entityType]: data.hasOwnerFraction,
    };
  });

  const graphData = timestamps.map((timestamp) => {
    return data.reduce((previous, current) => {
      if (current.timestamp === timestamp) {
        return { ...previous, ...current };
      }

      return previous;
    }, {});
  });

  return { data: graphData, entities };
};

export const getEntityTiersData = () => {
  const tiers: string[] = [];
  const timestamps: string[] = [];
  const NO_TIER = 'No Tier';

  const data = ENTITY_TIER.map((data) => {
    const tiering = data.entityTier ?? NO_TIER;
    const timestamp = getFormattedDateFromMilliSeconds(data.timestamp);
    if (!tiers.includes(tiering)) {
      tiers.push(tiering);
    }

    if (!timestamps.includes(timestamp)) {
      timestamps.push(timestamp);
    }

    return {
      timestamp: timestamp,
      [tiering]: data.entityCount,
    };
  });

  const graphData = timestamps.map((timestamp) => {
    return data.reduce((previous, current) => {
      if (current.timestamp === timestamp) {
        return { ...previous, ...current };
      }

      return previous;
    }, {});
  });

  return { data: graphData, tiers };
};
