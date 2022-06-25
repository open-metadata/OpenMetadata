export const getUserCurrentTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'tasks':
      currentTab = 2;

      break;
    case 'mydata':
      currentTab = 3;

      break;
    case 'following':
      currentTab = 4;

      break;
    case 'activity':
    default:
      currentTab = 1;
  }

  return currentTab;
};

export const profileInfo = [
  {
    tab: 1,
    path: 'activity',
  },
  {
    tab: 2,
    path: 'tasks',
  },
  {
    tab: 3,
    path: 'mydata',
  },
  {
    tab: 4,
    path: 'following',
  },
];
