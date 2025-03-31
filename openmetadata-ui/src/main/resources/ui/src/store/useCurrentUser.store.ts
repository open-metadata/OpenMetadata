/*
 *  Copyright 2024 Collate.
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
import { create } from 'zustand';
import {
  AuthenticationConfigurationWithScope,
  IAuthContext,
  UserProfile,
} from '../components/Auth/AuthProviders/AuthProvider.interface';
import { AuthenticationConfiguration } from '../generated/configuration/authenticationConfiguration';
import { AuthorizerConfiguration } from '../generated/configuration/authorizerConfiguration';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/entity/type';
import { Page, PageType } from '../generated/system/ui/page';
import { NavigationItem } from '../generated/system/ui/uiCustomization';
import { HelperFunctions } from '../interface/store.interface';
import { getOidcToken } from '../utils/LocalStorageUtils';

export const OM_SESSION_KEY = 'om-session';

interface CurrentUserStore extends IAuthContext {
  userProfilePics: Record<string, User>;
  selectedPersona: EntityReference;
  isApplicationLoading: boolean;
  customizedPages: Record<PageType, Page> | undefined;
  customizeNavigation: NavigationItem[] | undefined;
  setHelperFunctionsRef: (helperFunctions: HelperFunctions) => void;
  setSelectedPersona: (persona: EntityReference) => void;
  updateUserProfilePics: ({ id, user }: { id: string; user: User }) => void;
  setApplicationLoading: (loading: boolean) => void;
  setCustomizedPages: (pages: Record<PageType, Page>) => void;
  setCustomizeNavigation: (navigation: NavigationItem[]) => void;
  setJwtPrincipalClaims: (
    claims: AuthenticationConfiguration['jwtPrincipalClaims']
  ) => void;
  setJwtPrincipalClaimsMapping: (
    claimMapping: AuthenticationConfiguration['jwtPrincipalClaimsMapping']
  ) => void;
  setCurrentUser: (user: User) => void;
  setAuthConfig: (authConfig: AuthenticationConfigurationWithScope) => void;
  setAuthorizerConfig: (authorizerConfig: AuthorizerConfiguration) => void;
}

export const useCurrentUserStore = create<CurrentUserStore>()((set, get) => ({
  currentUser: undefined,
  newUser: undefined,
  isAuthenticated: Boolean(getOidcToken()),
  authConfig: undefined,
  authorizerConfig: undefined,
  isSigningUp: false,
  jwtPrincipalClaims: [],
  jwtPrincipalClaimsMapping: [],
  userProfilePics: {},
  selectedPersona: {} as EntityReference,
  isApplicationLoading: false,
  applicationConfig: undefined,
  customizedPages: undefined,
  customizeNavigation: undefined,

  setHelperFunctionsRef: (helperFunctions: HelperFunctions) => {
    set({ ...helperFunctions });
  },

  setSelectedPersona: (persona: EntityReference) => {
    set({ selectedPersona: persona });
  },

  setCurrentUser: (user: User) => {
    const { personas, defaultPersona } = user;
    // Update selected Persona to fetch the customized pages
    if (defaultPersona && personas?.find((p) => p.id === defaultPersona.id)) {
      set({ selectedPersona: defaultPersona });
    }

    // Update the current user
    set({ currentUser: user });
  },
  setAuthConfig: (authConfig: AuthenticationConfigurationWithScope) => {
    set({ authConfig });
  },
  setAuthorizerConfig: (authorizerConfig: AuthorizerConfiguration) => {
    set({ authorizerConfig });
  },
  setJwtPrincipalClaims: (
    claims: AuthenticationConfiguration['jwtPrincipalClaims']
  ) => {
    set({ jwtPrincipalClaims: claims });
  },
  setJwtPrincipalClaimsMapping: (
    claimMapping: AuthenticationConfiguration['jwtPrincipalClaimsMapping']
  ) => {
    set({ jwtPrincipalClaimsMapping: claimMapping });
  },
  setIsAuthenticated: (authenticated: boolean) => {
    set({ isAuthenticated: authenticated });
  },
  setIsSigningUp: (signingUp: boolean) => {
    set({ isSigningUp: signingUp });
  },

  onLoginHandler: () => {
    // This is a placeholder function that will be replaced by the actual function
  },
  /**
   * Handler to perform logout within application
   */
  onLogoutHandler: () => {
    // This is a placeholder function that will be replaced by the actual function
  },

  handleSuccessfulLogin: () => {
    // This is a placeholder function that will be replaced by the actual function
  },
  handleFailedLogin: () => {
    // This is a placeholder function that will be replaced by the actual function
  },
  updateAxiosInterceptors: () => {
    // This is a placeholder function that will be replaced by the actual function
  },
  updateCurrentUser: (user) => {
    set({ currentUser: user });
  },
  updateUserProfilePics: ({ id, user }: { id: string; user: User }) => {
    set({
      userProfilePics: { ...get()?.userProfilePics, [id]: user },
    });
  },
  updateNewUser: (user) => {
    set({ newUser: user });
  },
  setApplicationLoading: (loading: boolean) => {
    set({ isApplicationLoading: loading });
  },
  setNewUser: (user: UserProfile) => {
    set({ newUser: user });
  },
  setCustomizedPages: (pages: Record<PageType, Page>) => {
    set({ customizedPages: pages });
  },
  setCustomizeNavigation: (navigation: NavigationItem[]) => {
    set({ customizeNavigation: navigation });
  },
}));
