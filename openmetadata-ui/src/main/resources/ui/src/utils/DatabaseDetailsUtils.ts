import { TabSpecificField } from '../enums/entity.enum';

export const databaseDetailsTabs = [
  {
    name: 'Tables',
    path: 'tables',
  },
  {
    name: 'Activity Feed',
    path: 'activity_feed',
    field: TabSpecificField.ACTIVITY_FEED,
  },
  {
    name: 'Manage',
    path: 'manage',
  },
];

export const getCurrentDatabaseDetailsTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'activity_feed':
      currentTab = 2;

      break;
    case 'manage':
      currentTab = 3;

      break;

    case 'tables':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};
