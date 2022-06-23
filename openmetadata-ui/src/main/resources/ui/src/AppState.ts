/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { isEmpty, isNil, isUndefined } from 'lodash';
import { action, makeAutoObservable } from 'mobx';
import { ClientAuth, NewUser, UserPermissions } from 'Models';
import { reactLocalStorage } from 'reactjs-localstorage';
import { LOCALSTORAGE_USER_PROFILES } from './constants/constants';
import { CurrentTourPageType } from './enums/tour.enum';
import { Role } from './generated/entity/teams/role';
import {
  EntityReference as UserTeams,
  User,
} from './generated/entity/teams/user';
import { ImageList } from './generated/type/profile';

class AppState {
  urlPathname = '';
  users: Array<User> = [];
  newUser: NewUser = {} as NewUser;
  authDisabled = false;
  authProvider: ClientAuth = {
    authority: '',
    // eslint-disable-next-line @typescript-eslint/camelcase
    client_id: '',
    signingIn: false,
  };
  nonSecureUserDetails: User = {} as User;
  userDetails: User = {} as User;
  userTeams: Array<UserTeams> = [];
  userRoles: Array<Role> = [];
  userPermissions: UserPermissions = {} as UserPermissions;
  userProfilePics: Array<{
    id: string;
    name: string;
    profile: ImageList['image512'];
  }> = [];
  userProfilePicsLoading: Array<{
    id: string;
    name: string;
  }> = [];

  inPageSearchText = '';
  explorePageTab = 'tables';

  isTourOpen = false;
  currentTourPage: CurrentTourPageType = CurrentTourPageType.MY_DATA_PAGE;
  activeTabforTourDatasetPage = 1;

  constructor() {
    makeAutoObservable(this, {
      updateUserDetails: action,
      updateUserTeam: action,
      updateNewUser: action,
      updateAuthProvide: action,
      updateAuthState: action,
      updateUserRole: action,
      updateUsers: action,
      updateUserPermissions: action,
      updateExplorePageTab: action,
      getCurrentUserDetails: action,
      getAllUsers: action,
      getAllTeams: action,
      getAllRoles: action,
      getAllPermissions: action,
      getUserProfilePic: action,
      updateUserProfilePic: action,
      loadUserProfilePics: action,
      getProfilePicsLoading: action,
      updateProfilePicsLoading: action,
      isProfilePicLoading: action,
      removeProfilePicsLoading: action,
      getUrlPathname: action,
      updateUrlPathname: action,
    });
  }

  updateUrlPathname(data: string) {
    this.urlPathname = data;
  }

  getUrlPathname() {
    return this.urlPathname;
  }

  addUser(data: User) {
    this.users = [...this.users, data];
  }
  updateUsers(data: Array<User>) {
    this.users = data;
    this.nonSecureUserDetails = data[0];
  }
  updateUserTeam(data: Array<UserTeams>) {
    this.userTeams = data;
  }
  updateUserRole(data: Array<Role>) {
    this.userRoles = data;
  }
  updateUserDetails(data: User) {
    this.userDetails = data;
    this.nonSecureUserDetails = data;
  }
  updateNewUser(data: NewUser) {
    this.newUser = data;
  }
  updateAuthProvide(clientAuth: ClientAuth) {
    this.authProvider = clientAuth;
  }
  updateAuthState(state: boolean) {
    this.authDisabled = state;
  }
  updateUserPermissions(permissions: UserPermissions) {
    this.userPermissions = permissions;
  }
  updateExplorePageTab(tab: string) {
    this.explorePageTab = tab;
  }

  updateUserProfilePic(
    id?: string,
    username?: string,
    profile?: ImageList['image512']
  ) {
    if (!id && !username) {
      return;
    }

    const filteredList = this.userProfilePics.filter((item) => {
      // compare id only if present
      if (item.id && id) {
        return item.id !== id;
      } else {
        return item.name !== username;
      }
    });
    this.userProfilePics = [
      ...filteredList,
      {
        id: id || '',
        name: username || '',
        profile,
      },
    ];

    reactLocalStorage.setObject(LOCALSTORAGE_USER_PROFILES, {
      data: this.userProfilePics,
    });

    return profile;
  }

  updateProfilePicsLoading(id?: string, username?: string) {
    if (!id && !username) {
      return;
    }

    const alreadyLoading = !isUndefined(
      this.userProfilePicsLoading.find((loadingItem) => {
        // compare id only if present
        if (loadingItem.id && id) {
          return loadingItem.id === id;
        } else {
          return loadingItem.name === username;
        }
      })
    );

    if (!alreadyLoading) {
      this.userProfilePicsLoading = [
        ...this.userProfilePicsLoading,
        {
          id: id || '',
          name: username || '',
        },
      ];
    }
  }

  removeProfilePicsLoading(id?: string, username?: string) {
    if (!id && !username) {
      return;
    }

    const filteredList = this.userProfilePicsLoading.filter((loadingItem) => {
      // compare id only if present
      if (loadingItem.id && id) {
        return loadingItem.id !== id;
      } else {
        return loadingItem.name !== username;
      }
    });

    this.userProfilePicsLoading = filteredList;
  }

  loadUserProfilePics() {
    const { data } = reactLocalStorage.getObject(
      LOCALSTORAGE_USER_PROFILES
    ) as {
      data: Array<{
        id: string;
        name: string;
        profile: ImageList['image512'];
      }>;
    };
    if (data) {
      this.userProfilePics = data;
    }
  }

  getCurrentUserDetails() {
    if (!isEmpty(this.userDetails) && !isNil(this.userDetails)) {
      return this.userDetails;
    } else if (
      !isEmpty(this.nonSecureUserDetails) &&
      !isNil(this.nonSecureUserDetails)
    ) {
      return this.nonSecureUserDetails;
    } else {
      return;
    }
  }

  getUserProfilePic(id?: string, username?: string) {
    const data = this.userProfilePics.find((item) => {
      // compare id only if present
      if (item.id && id) {
        return item.id === id;
      } else {
        return item.name === username;
      }
    });

    return data?.profile;
  }

  getAllUserProfilePics() {
    return this.userProfilePics;
  }

  getProfilePicsLoading() {
    return this.userProfilePicsLoading;
  }

  isProfilePicLoading(id?: string, username?: string) {
    const data = this.userProfilePicsLoading.find((loadingPic) => {
      // compare id only if present
      if (loadingPic.id && id) {
        return loadingPic.id === id;
      } else {
        return loadingPic.name === username;
      }
    });

    return Boolean(data);
  }

  getAllUsers() {
    return this.users;
  }

  getAllTeams() {
    return this.userTeams;
  }

  getAllRoles() {
    return this.userRoles;
  }

  getAllPermissions() {
    return this.userPermissions;
  }
}

export default new AppState();
