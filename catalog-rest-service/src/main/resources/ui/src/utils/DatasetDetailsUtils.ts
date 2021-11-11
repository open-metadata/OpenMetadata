export const datasetTableTabs = [
  {
    name: 'Schema',
    path: 'schema.schema',
  },
  {
    name: 'Profiler',
    path: 'profiler',
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

export const getCurrentDatasetTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'profiler':
      currentTab = 2;

      break;
    case 'lineage':
      currentTab = 3;

      break;
    case 'manage':
      currentTab = 4;

      break;

    case 'schema.schema':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};
