import { TabSpecificField } from '../enums/entity.enum';

export const databaseSchemaDetailsTabs = [
  {
    name: 'Tables',
    path: 'tables',
  },
  {
    name: 'Activity Feeds',
    path: 'activity_feed',
    field: TabSpecificField.ACTIVITY_FEED,
  },
];

export const getCurrentDatabaseSchemaDetailsTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'activity_feed':
      currentTab = 2;

      break;

    case 'tables':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};
