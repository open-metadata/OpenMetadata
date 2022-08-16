import { TabSpecificField } from '../enums/entity.enum';

export const databaseDetailsTabs = [
  {
    name: 'Schemas',
    path: 'schemas',
  },
  {
    name: 'Activity Feed',
    path: 'activity_feed',
    field: TabSpecificField.ACTIVITY_FEED,
  },
];

export const getCurrentDatabaseDetailsTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'activity_feed':
      currentTab = 2;

      break;

    case 'schemas':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};
