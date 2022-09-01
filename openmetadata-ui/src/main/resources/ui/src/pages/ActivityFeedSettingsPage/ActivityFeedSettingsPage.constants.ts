import { Filters } from '../../generated/settings/settings';

export const formData = [
  {
    eventType: 'entityCreated',
    include: [],
  },
  {
    eventType: 'entityUpdated',
    include: [],
  },
  {
    eventType: 'entitySoftDeleted',
    include: [],
  },
  {
    eventType: 'entityDeleted',
    include: [],
  },
] as Filters[];

export const ActivityFeedEntity = {
  table: 'Table',
  topic: 'Topic',
  dashboard: 'Dashboard',
  pipeline: 'Pipeline',
  mlmodel: 'ML Model',
} as Record<string, string>;
