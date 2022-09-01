import { Filters } from '../../generated/settings/settings';

export const formData = [
  {
    eventType: 'entityCreated',
    fields: [],
  },
  {
    eventType: 'entityUpdated',
    fields: [],
  },
  {
    eventType: 'entitySoftDeleted',
    fields: [],
  },
  {
    eventType: 'entityDeleted',
    fields: [],
  },
] as Filters[];

export const ActivityFeedEntity = {
  table: 'Table',
  topic: 'Topic',
  dashboard: 'Dashboard',
  pipeline: 'Pipeline',
  mlmodel: 'ML Model',
} as Record<string, string>;
