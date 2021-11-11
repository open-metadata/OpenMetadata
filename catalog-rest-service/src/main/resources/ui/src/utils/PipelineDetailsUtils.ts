export const pipelineDetailsTabs = [
  {
    name: 'Details',
    path: 'details',
  },
  {
    name: 'Lineage',
    path: 'lineage',
  },
  {
    name: 'Manage',
    path: 'manage',
  },
];

export const getCurrentPipelineTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'lineage':
      currentTab = 2;

      break;
    case 'manage':
      currentTab = 3;

      break;

    case 'details':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};
