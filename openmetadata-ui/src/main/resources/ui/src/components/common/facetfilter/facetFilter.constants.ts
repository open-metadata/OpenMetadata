import { capitalize } from 'lodash';

const aggregationKeyToTitleMap: Record<string, string> = {
  serviceType: 'Service',
  'databaseSchema.name.keyword': 'Schema',
  'database.name.keyword': 'Database',
  'tier.tagFQN': 'Tier',
  'tags.tagFQN': 'Tag',
  'service.name.keyword': 'Service Name',
  entityType: 'Entity Type',
};

const aggregationKeyOrdering: Record<string, number> = {
  serviceType: 0,
  'tier.tagFQN': 1,
  'tags.tagFQN': 2,
  'service.name.keyword': 3,
  'database.name.keyword': 4,
  'databaseSchema.name.keyword': 5,
};

export const translateAggregationKeyToTitle: (key: string) => string = (
  key
) => {
  if (key in aggregationKeyToTitleMap) {
    return aggregationKeyToTitleMap[key];
  }

  return key
    .split('.')
    .filter((ss) => ss !== 'keyword')
    .reduce((prev, curr) => `${prev} ${capitalize(curr)}`, '');
};

export const compareAggregationKey: (key1: string, key2: string) => number = (
  key1,
  key2
) => {
  const key1Val =
    key1 in aggregationKeyOrdering ? aggregationKeyOrdering[key1] : 1000;
  const key2Val =
    key2 in aggregationKeyOrdering ? aggregationKeyOrdering[key2] : 1000;

  return key1Val - key2Val;
};
