export const getUserCurrentTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'mydata':
      currentTab = 2;

      break;
    case 'following':
      currentTab = 3;

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
    path: 'mydata',
  },
  {
    tab: 3,
    path: 'following',
  },
];
