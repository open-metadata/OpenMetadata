import { Filters } from '../../generated/settings/settings';

export const formData = [
  {
    eventType: 'entityCreated',
    include: [],
    exclude: [],
  },
  {
    eventType: 'entityUpdated',
    include: [],
    exclude: [],
  },
  {
    eventType: 'entitySoftDeleted',
    include: [],
    exclude: [],
  },
  {
    eventType: 'entityDeleted',
    include: [],
    exclude: [],
  },
] as Filters[];

export const ActivityFeedEntity = {
  table: 'Table',
  topic: 'Topic',
  dashboard: 'Dashboard',
  pipeline: 'Pipeline',
  mlmodel: 'ML Model',
  testCase: 'Test Case',
} as Record<string, string>;
