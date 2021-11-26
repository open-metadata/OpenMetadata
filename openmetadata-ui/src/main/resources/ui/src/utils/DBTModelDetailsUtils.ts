export const dbtModelTabs = [
  {
    name: 'Schema',
    path: 'schema',
  },
  {
    name: 'View Definition',
    path: 'view_definition',
  },
  {
    name: 'Manage',
    path: 'manage',
  },
];

export const getCurrentDBTModelTab = (tab: string): number => {
  let currentTab;
  switch (tab) {
    case 'view_definition':
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
