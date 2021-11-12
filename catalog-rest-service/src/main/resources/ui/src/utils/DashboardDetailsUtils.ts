export const dashboardDetailsTabs = [
  {
    name: 'Details',
    path: 'details',
  },
  {
    name: 'Manage',
    path: 'manage',
  },
];

export const getCurrentDashboardTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'manage':
      currentTab = 2;

      break;

    case 'details':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};
