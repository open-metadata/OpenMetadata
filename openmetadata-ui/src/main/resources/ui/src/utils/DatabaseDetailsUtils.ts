export const databaseDetailsTabs = [
  {
    name: 'Tables',
    path: 'tables',
  },
  {
    name: 'Manage',
    path: 'manage',
  },
];

export const getCurrentDatabaseDetailsTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'manage':
      currentTab = 2;

      break;

    case 'tables':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};
