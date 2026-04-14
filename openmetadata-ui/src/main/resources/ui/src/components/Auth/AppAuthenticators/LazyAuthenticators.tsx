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

import type { WebStorageStateStore } from 'oidc-client';
import { ComponentType, forwardRef, lazy, ReactNode, Suspense } from 'react';
import Loader from '../../common/Loader/Loader';
import { AuthenticatorRef } from '../AuthProviders/AuthProvider.interface';

const Auth0Authenticator = lazy(() => import('./Auth0Authenticator'));
const BasicAuthAuthenticator = lazy(() => import('./BasicAuthAuthenticator'));
const MsalAuthenticator = lazy(() => import('./MsalAuthenticator'));
const OidcAuthenticator = lazy(() => import('./OidcAuthenticator'));
const OktaAuthenticator = lazy(() => import('./OktaAuthenticator'));
const GenericAuthenticator = lazy(() =>
  import('./GenericAuthenticator').then((m) => ({
    default: m.GenericAuthenticator,
  }))
);

export const LazyAuth0Authenticator = forwardRef<
  AuthenticatorRef,
  { children: ReactNode }
>((props, ref) => (
  <Suspense fallback={<Loader fullScreen />}>
    <Auth0Authenticator ref={ref} {...props} />
  </Suspense>
));

LazyAuth0Authenticator.displayName = 'LazyAuth0Authenticator';

export const LazyBasicAuthAuthenticator = forwardRef<
  AuthenticatorRef,
  { children: ReactNode }
>((props, ref) => (
  <Suspense fallback={<Loader fullScreen />}>
    <BasicAuthAuthenticator ref={ref} {...props} />
  </Suspense>
));

LazyBasicAuthAuthenticator.displayName = 'LazyBasicAuthAuthenticator';

export const LazyMsalAuthenticator = forwardRef<
  AuthenticatorRef,
  { children: ReactNode }
>((props, ref) => (
  <Suspense fallback={<Loader fullScreen />}>
    <MsalAuthenticator ref={ref} {...props} />
  </Suspense>
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
  <Suspense fallback={<Loader fullScreen />}>
    <OidcAuthenticator ref={ref} {...props} />
  </Suspense>
));

LazyOidcAuthenticator.displayName = 'LazyOidcAuthenticator';

export const LazyOktaAuthenticator = forwardRef<
  AuthenticatorRef,
  { children: ReactNode }
>((props, ref) => (
  <Suspense fallback={<Loader fullScreen />}>
    <OktaAuthenticator ref={ref} {...props} />
  </Suspense>
));

LazyOktaAuthenticator.displayName = 'LazyOktaAuthenticator';

export const LazyGenericAuthenticator = forwardRef<
  AuthenticatorRef,
  { children: ReactNode }
>((props, ref) => (
  <Suspense fallback={<Loader fullScreen />}>
    <GenericAuthenticator ref={ref} {...props} />
  </Suspense>
));

LazyGenericAuthenticator.displayName = 'LazyGenericAuthenticator';
