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

export const USER_PROFILE_TABS = [
  {
    name: 'Activity',
    isProtected: false,
    position: 1,
  },
  {
    name: 'Tasks',
    isProtected: false,
    position: 2,
  },
  {
    name: 'My Data',
    isProtected: false,
    position: 3,
  },
  {
    name: 'Following',
    isProtected: false,
    position: 4,
  },
];
