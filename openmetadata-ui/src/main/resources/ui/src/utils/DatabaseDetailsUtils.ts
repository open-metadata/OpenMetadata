import i18next from 'i18next';
import { TabSpecificField } from '../enums/entity.enum';

export const databaseDetailsTabs = [
  {
    name: i18next.t('label.schemas'),
    path: 'schemas',
  },
  {
    name: i18next.t('label.activity-feeds'),
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
