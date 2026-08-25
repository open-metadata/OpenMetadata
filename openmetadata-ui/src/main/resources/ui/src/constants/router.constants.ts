/*
 *  Copyright 2022 Collate.
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

export const APP_ROUTER_ROUTES = {
  HOME: '/',
  MY_DATA: '/my-data',
  NOT_FOUND: '/404',
  LOGOUT: '/logout',
  UNAUTHORISED: '/unauthorised',
  SIGNUP: '/signup',
  AUTH_CALLBACK: '/auth/callback',
  SIGNIN: '/signin',
  FORGOT_PASSWORD: '/forgot-password',
  CALLBACK: '/callback',
  SILENT_CALLBACK: '/silent-callback',
  REGISTER: '/register',
  RESET_PASSWORD: '/users/password/reset',
  ACCOUNT_ACTIVATION: '/users/registrationConfirmation',
} as const;

export const UNPROTECTED_ROUTES: Set<string> = new Set([
  APP_ROUTER_ROUTES.SIGNUP,
  APP_ROUTER_ROUTES.SIGNIN,
  APP_ROUTER_ROUTES.FORGOT_PASSWORD,
  APP_ROUTER_ROUTES.CALLBACK,
  APP_ROUTER_ROUTES.SILENT_CALLBACK,
  APP_ROUTER_ROUTES.REGISTER,
  APP_ROUTER_ROUTES.RESET_PASSWORD,
  APP_ROUTER_ROUTES.ACCOUNT_ACTIVATION,
  APP_ROUTER_ROUTES.HOME,
  APP_ROUTER_ROUTES.AUTH_CALLBACK,
  APP_ROUTER_ROUTES.NOT_FOUND,
  APP_ROUTER_ROUTES.LOGOUT,
]);

export const REDIRECT_PATHNAME = 'redirectUrlPath';
