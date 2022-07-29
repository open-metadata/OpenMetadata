import { isEmpty, isNil } from 'lodash';
import {
  ClientAuth,
  EntityReference,
  NewUser,
  User,
  UserPermissions,
} from 'Models';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useReducer,
} from 'react';
import { CurrentTourPageType } from './enums/tour.enum';
import { Role } from './generated/entity/teams/role';
import { ImageList } from './generated/type/profile';
import { EntityData } from './pages/TasksPage/TasksPage.interface';

const AppStateContext = createContext<AppStateContextProps>(
  {} as AppStateContextProps
);

interface AppStateContextProps extends AppState {
  updateUser: (user: User) => void;
  updateUrlPathname: (pathname: string) => void;
  updateNewUser: (user: NewUser) => void;
  getCurrentUserDetails: () => User | undefined;
  updateAuthProvide: (config: ClientAuth) => void;
  updateAuthState: (state: boolean) => void;
  updateUserPermissions: (permissions: UserPermissions) => void;
  updateExplorePageTab: (tab: string) => void;
  updateUserProfilePic: (
    id?: string,
    username?: string,
    profile?: ImageList['image512']
  ) => void;
  updateUsers: (users: Array<User>) => void;
  updateUserTeam: (userTeams: Array<EntityReference>) => void;
  updateUserRole: (userRoles: Array<Role>) => void;
  updateUserDetails: (user: User) => void;
}

interface AppState {
  urlPathname: string;
  users: Array<User>;
  newUser: NewUser;
  authDisabled: boolean;
  authProvider: ClientAuth;
  nonSecureUserDetails: User;
  userDetails: User;
  userDataProfiles: Record<string, User>;
  entityData: Record<string, EntityData>;
  userTeams: Array<EntityReference>;
  userRoles: Array<Role>;
  userPermissions: UserPermissions;
  userProfilePics: Array<{
    id: string;
    name: string;
    profile: ImageList['image512'];
  }>;
  userProfilePicsLoading: Array<{
    id: string;
    name: string;
  }>;

  inPageSearchText: string;
  explorePageTab: string;

  isTourOpen: boolean;
  currentTourPage: CurrentTourPageType;
  activeTabforTourDatasetPage: number;
}

interface AppStateProviderProps {
  children: ReactNode;
}

interface Action {
  payload: Partial<AppState>;
  type: 'UPDATE_STATE';
}

const reducer = (prevState: AppState, action: Action) => {
  switch (action.type) {
    case 'UPDATE_STATE':
      return { ...prevState, ...action.payload };
    default:
      return prevState;
  }
};

export const AppStateProvider = ({ children }: AppStateProviderProps) => {
  const [state, dispatch] = useReducer(reducer, {
    urlPathname: '',
    users: [],
    newUser: {} as NewUser,
    authDisabled: false,
    authProvider: {
      authority: '',
      // eslint-disable-next-line @typescript-eslint/camelcase
      client_id: '',
      signingIn: false,
    },
    nonSecureUserDetails: {} as User,
    userDetails: {} as User,
    userDataProfiles: {} as Record<string, User>,
    entityData: {} as Record<string, EntityData>,
    userTeams: [] as Array<EntityReference>,
    userRoles: [] as Array<Role>,
    userPermissions: {} as UserPermissions,
    userProfilePics: [] as Array<{
      id: string;
      name: string;
      profile: ImageList['image512'];
    }>,
    userProfilePicsLoading: [] as Array<{
      id: string;
      name: string;
    }>,
    inPageSearchText: '',
    explorePageTab: 'tables',
    isTourOpen: false,
    currentTourPage: CurrentTourPageType.MY_DATA_PAGE,
    activeTabforTourDatasetPage: 1,
  } as AppState);

  const updateState = (newState: Partial<AppState>) => {
    dispatch({ type: 'UPDATE_STATE', payload: newState });
  };

  const updateUrlPathname = (data: string) => {
    updateState({ urlPathname: data });
  };

  const updateUser = (data: User) => {
    updateState({ users: [data] });
  };

  const updateUsers = (users: Array<User>) => {
    updateState({
      users,
      nonSecureUserDetails: users[0],
    });
  };

  const updateUserTeam = (userTeams: Array<EntityReference>) => {
    updateState({
      userTeams,
    });
  };

  const updateUserRole = (userRoles: Array<Role>) => {
    updateState({
      userRoles,
    });
  };

  const updateUserDetails = (user: User) => {
    updateState({ userDetails: user, nonSecureUserDetails: user });
  };

  const updateNewUser = (data: NewUser) => {
    updateState({ newUser: data });
  };

  const updateAuthProvide = (clientAuth: ClientAuth) => {
    updateState({ authProvider: clientAuth });
  };

  const updateAuthState = (authDisabled: boolean) => {
    updateState({ authDisabled });
  };

  const updateUserPermissions = (userPermissions: UserPermissions) => {
    updateState({ userPermissions });
  };

  const updateExplorePageTab = (explorePageTab: string) => {
    updateState({ explorePageTab });
  };

  const updateUserProfilePic = useCallback(
    (id?: string, username?: string, profile?: ImageList['image512']) => {
      if (!id && !username) {
        return;
      }

      const filteredList = state.userProfilePics.filter((item) => {
        // compare id only if present
        if (item.id && id) {
          return item.id !== id;
        } else {
          return item.name !== username;
        }
      });
      const userProfilePics = [
        ...filteredList,
        {
          id: id || '',
          name: username || '',
          profile,
        },
      ];

      updateState({ userProfilePics });

      // reactLocalStorage.setObject(LOCALSTORAGE_USER_PROFILES, {
      //   data: this.userProfilePics,
      // });

      // return profile;
    },
    state.userProfilePics
  );

  //   updateProfilePicsLoading(id?: string, username?: string) {
  //     if (!id && !username) {
  //       return;
  //     }

  //     const alreadyLoading = !isUndefined(
  //       this.userProfilePicsLoading.find((loadingItem) => {
  //         // compare id only if present
  //         if (loadingItem.id && id) {
  //           return loadingItem.id === id;
  //         } else {
  //           return loadingItem.name === username;
  //         }
  //       })
  //     );

  //     if (!alreadyLoading) {
  //       this.userProfilePicsLoading = [
  //         ...this.userProfilePicsLoading,
  //         {
  //           id: id || '',
  //           name: username || '',
  //         },
  //       ];
  //     }
  //   }

  //   removeProfilePicsLoading(id?: string, username?: string) {
  //     if (!id && !username) {
  //       return;
  //     }

  //     const filteredList = this.userProfilePicsLoading.filter((loadingItem) => {
  //       // compare id only if present
  //       if (loadingItem.id && id) {
  //         return loadingItem.id !== id;
  //       } else {
  //         return loadingItem.name !== username;
  //       }
  //     });

  //     this.userProfilePicsLoading = filteredList;
  //   }

  //   loadUserProfilePics() {
  //     const { data } = reactLocalStorage.getObject(
  //       LOCALSTORAGE_USER_PROFILES
  //     ) as {
  //       data: Array<{
  //         id: string;
  //         name: string;
  //         profile: ImageList['image512'];
  //       }>;
  //     };
  //     if (data) {
  //       this.userProfilePics = data;
  //     }
  //   }

  const getCurrentUserDetails = useCallback(() => {
    if (!isEmpty(state.userDetails) && !isNil(state.userDetails)) {
      return state.userDetails;
    } else if (
      !isEmpty(state.nonSecureUserDetails) &&
      !isNil(state.nonSecureUserDetails)
    ) {
      return state.nonSecureUserDetails;
    } else {
      return;
    }
  }, [state.userDetails, state.nonSecureUserDetails]);

  //   getUserProfilePic(id?: string, username?: string) {
  //     const data = this.userProfilePics.find((item) => {
  //       // compare id only if present
  //       if (item.id && id) {
  //         return item.id === id;
  //       } else {
  //         return item.name === username;
  //       }
  //     });

  //     return data?.profile;
  //   }

  //   getAllUserProfilePics() {
  //     return this.userProfilePics;
  //   }

  //   getProfilePicsLoading() {
  //     return this.userProfilePicsLoading;
  //   }

  //   isProfilePicLoading(id?: string, username?: string) {
  //     const data = this.userProfilePicsLoading.find((loadingPic) => {
  //       // compare id only if present
  //       if (loadingPic.id && id) {
  //         return loadingPic.id === id;
  //       } else {
  //         return loadingPic.name === username;
  //       }
  //     });

  //     return Boolean(data);
  //   }

  const contextValues = {
    ...state,
    updateUser,
    updateUrlPathname,
    updateNewUser,
    getCurrentUserDetails,
    updateAuthProvide,
    updateAuthState,
    updateUserPermissions,
    updateExplorePageTab,
    updateUserProfilePic,
    updateUsers,
    updateUserTeam,
    updateUserRole,
    updateUserDetails,
  };

  return (
    <AppStateContext.Provider value={contextValues}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => useContext(AppStateContext);
