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

import { isEmpty } from 'lodash';
import AppState from '../AppState';
import { ROUTES } from '../constants/constants';

export const useAuth = (pathname = '') => {
  const { authDisabled, userDetails, newUser, authProvider } = AppState;
  const isAuthenticatedRoute =
    pathname !== ROUTES.SIGNUP &&
    pathname !== ROUTES.SIGNIN &&
    pathname !== ROUTES.CALLBACK;

  return {
    isSigningIn: authProvider.signingIn,
    isSignedIn: authDisabled || !isEmpty(userDetails),
    isSigningUp: !authDisabled && !isEmpty(newUser),
    isSignedOut:
      !authDisabled &&
      !authProvider.signingIn &&
      isEmpty(userDetails) &&
      isEmpty(newUser),
    isAuthenticatedRoute: isAuthenticatedRoute,
    isAuthDisabled: authDisabled,
    isAdminUser: userDetails?.isAdmin,
    isFirstTimeUser: !isEmpty(userDetails) && !isEmpty(newUser),
  };
};
