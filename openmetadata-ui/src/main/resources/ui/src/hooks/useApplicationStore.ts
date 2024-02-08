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
import { FC } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  AuthenticationConfigurationWithScope,
  IAuthContext,
  OidcUser,
} from '../components/Auth/AuthProviders/AuthProvider.interface';
import { EntityUnion } from '../components/Explore/ExplorePage.interface';
import { AuthenticationConfiguration } from '../generated/configuration/authenticationConfiguration';
import { AuthorizerConfiguration } from '../generated/configuration/authorizerConfiguration';
import { LoginConfiguration } from '../generated/configuration/loginConfiguration';
import { LogoConfiguration } from '../generated/configuration/logoConfiguration';
import { User } from '../generated/entity/teams/user';
import { EntityReference } from '../generated/entity/type';

export const OM_SESSION_KEY = 'om-session';
interface HelperFunctions {
  onLoginHandler: () => void;
  onLogoutHandler: () => void;
  getCallBackComponent: () => FC | null;
  handleSuccessfulLogin: (user: OidcUser) => void;
  updateAxiosInterceptors: () => void;
}

export interface ApplicationStore
  extends IAuthContext,
    LogoConfiguration,
    LoginConfiguration {
  userProfilePics: Record<string, User>;
  cachedEntityData: Record<string, EntityUnion>;
  urlPathName: string;
  selectedPersona: EntityReference;
  oidcIdToken: string;
  refreshTokenKey: string;
  authConfig?: AuthenticationConfigurationWithScope;
  setCurrentUser: (user: User) => void;
  setAuthConfig: (authConfig: AuthenticationConfigurationWithScope) => void;
  setAuthorizerConfig: (authorizerConfig: AuthorizerConfiguration) => void;
  setJwtPrincipalClaims: (
    claims: AuthenticationConfiguration['jwtPrincipalClaims']
  ) => void;
  setHelperFunctionsRef: (helperFunctions: HelperFunctions) => void;
  updateUserProfilePics: (data: { id: string; user: User }) => void;
  updateCachedEntityData: (data: {
    id: string;
    entityDetails: EntityUnion;
  }) => void;
  updateSelectedPersona: (personaFqn: EntityReference) => void;

  getRefreshToken: () => string;
  setRefreshToken: (refreshToken: string) => void;
  getOidcToken: () => string;
  setOidcToken: (oidcToken: string) => void;
  removeOidcToken: () => void;
  removeRefreshToken: () => void;
}

export const useApplicationStore = create<ApplicationStore>()(
  persist(
    (set, get) => ({
      currentUser: undefined,
      newUser: undefined,
      isAuthenticated: Boolean(
        JSON.parse(localStorage.getItem(OM_SESSION_KEY) ?? '{}')?.state
          ?.oidcIdToken
      ),
      authConfig: undefined,
      authorizerConfig: undefined,
      isSigningIn: false,
      jwtPrincipalClaims: [],
      userProfilePics: {},
      cachedEntityData: {},
      urlPathName: '',
      selectedPersona: {} as EntityReference,
      oidcIdToken: '',
      refreshTokenKey: '',
      loading: false,

      setHelperFunctionsRef: (helperFunctions: HelperFunctions) => {
        set({ ...helperFunctions });
      },

      setCurrentUser: (user) => {
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
      setIsAuthenticated: (authenticated: boolean) => {
        set({ isAuthenticated: authenticated });
      },
      setIsSigningIn: (signingIn: boolean) => {
        set({ isSigningIn: signingIn });
      },
      setLoadingIndicator: (loading: boolean) => {
        set({ loading });
      },

      onLoginHandler: () => {
        // This is a placeholder function that will be replaced by the actual function
      },
      onLogoutHandler: () => {
        // This is a placeholder function that will be replaced by the actual function
      },
      getCallBackComponent: () => {
        // This is a placeholder function that will be replaced by the actual function
        return null;
      },
      handleSuccessfulLogin: () => {
        // This is a placeholder function that will be replaced by the actual function
      },
      updateAxiosInterceptors: () => {
        // This is a placeholder function that will be replaced by the actual function
      },
      updateCurrentUser: (user) => {
        set({ currentUser: user });
      },
      updateUserProfilePics: (data) => {
        set({
          userProfilePics: { ...get()?.userProfilePics, [data.id]: data.user },
        });
      },
      updateCachedEntityData: (data) => {
        set({
          cachedEntityData: {
            ...get()?.cachedEntityData,
            [data.id]: data.entityDetails,
          },
        });
      },
      updateSelectedPersona: (personaFqn) => {
        set({ selectedPersona: personaFqn });
      },
      updateNewUser: (user) => {
        set({ newUser: user });
      },
      getRefreshToken: () => {
        return get()?.refreshTokenKey;
      },
      setRefreshToken: (refreshToken) => {
        set({ refreshTokenKey: refreshToken });
      },
      getOidcToken: () => {
        return get()?.oidcIdToken;
      },
      setOidcToken: (oidcToken) => {
        set({ oidcIdToken: oidcToken });
      },
      removeOidcToken: () => {
        set({ oidcIdToken: '' });
      },
      removeRefreshToken: () => {
        set({ refreshTokenKey: '' });
      },
    }),
    {
      name: OM_SESSION_KEY, // name of item in the storage (must be unique)
      partialize: (state) => ({
        oidcIdToken: state.oidcIdToken,
        refreshTokenKey: state.refreshTokenKey,
      }),
    }
  )
);
