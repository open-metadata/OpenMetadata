export const topicDetailsTabs = [
  {
    name: 'Schema',
    path: 'schema',
  },
  {
    name: 'Config',
    path: 'config',
  },
  {
    name: 'Manage',
    path: 'manage',
  },
];

export const getCurrentTopicTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'config':
      currentTab = 2;

      break;
    case 'manage':
      currentTab = 3;

      break;

    case 'schema':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};
