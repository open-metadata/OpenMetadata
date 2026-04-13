/*
 *  Copyright 2025 Collate.
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

import { type ComponentType, forwardRef, lazy, ReactNode } from 'react';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import type { WebStorageStateStore } from 'oidc-client';

const Auth0Authenticator = withSuspenseFallback(lazy(() => import('./Auth0Authenticator')));
const BasicAuthAuthenticator = withSuspenseFallback(lazy(() => import('./BasicAuthAuthenticator')));
const MsalAuthenticator = withSuspenseFallback(lazy(() => import('./MsalAuthenticator')));
const OidcAuthenticator = withSuspenseFallback(lazy(() => import('./OidcAuthenticator')));
const OktaAuthenticator = withSuspenseFallback(lazy(() => import('./OktaAuthenticator')));
const GenericAuthenticator = withSuspenseFallback(lazy(() =>
  import('./GenericAuthenticator').then((m) => ({
    default: m.GenericAuthenticator,
  }))
));

export const LazyAuth0Authenticator = forwardRef<
  AuthenticatorRef,
  { children: ReactNode }
>((props, ref) => (
  
    <Auth0Authenticator ref={ref} {...props} />
  
));

LazyAuth0Authenticator.displayName = 'LazyAuth0Authenticator';

export const LazyBasicAuthAuthenticator = forwardRef<
  AuthenticatorRef,
  { children: ReactNode }
>((props, ref) => (
  
    <BasicAuthAuthenticator ref={ref} {...props} />
  
));

LazyBasicAuthAuthenticator.displayName = 'LazyBasicAuthAuthenticator';

export const LazyMsalAuthenticator = forwardRef<
  AuthenticatorRef,
  { children: ReactNode }
>((props, ref) => (
  
    <MsalAuthenticator ref={ref} {...props} />
  
));

LazyMsalAuthenticator.displayName = 'LazyMsalAuthenticator';

export const LazyOidcAuthenticator = forwardRef<
  AuthenticatorRef,
  {
    children: ReactNode;
    childComponentType: ComponentType;
    userConfig: Record<string, string | boolean | WebStorageStateStore>;
  }
>((props, ref) => (
  
    <OidcAuthenticator ref={ref} {...props} />
  
));

LazyOidcAuthenticator.displayName = 'LazyOidcAuthenticator';

export const LazyOktaAuthenticator = forwardRef<
  AuthenticatorRef,
  { children: ReactNode }
>((props, ref) => (
  
    <OktaAuthenticator ref={ref} {...props} />
  
));

LazyOktaAuthenticator.displayName = 'LazyOktaAuthenticator';

export const LazyGenericAuthenticator = forwardRef<
  AuthenticatorRef,
  { children: ReactNode }
>((props, ref) => (
  
    <GenericAuthenticator ref={ref} {...props} />
  
));

LazyGenericAuthenticator.displayName = 'LazyGenericAuthenticator';
