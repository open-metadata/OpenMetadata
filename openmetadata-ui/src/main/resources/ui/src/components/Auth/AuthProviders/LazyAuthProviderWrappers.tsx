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

import { CacheLocation } from '@auth0/auth0-react';
import type { IPublicClientApplication } from '@azure/msal-browser';
import { lazy, ReactNode } from 'react';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';

const Auth0ProviderComponent = withSuspenseFallback(
  lazy(() =>
    import('@auth0/auth0-react').then((m) => ({ default: m.Auth0Provider }))
  )
);

const MsalProviderComponent = withSuspenseFallback(
  lazy(() =>
    import('@azure/msal-react').then((m) => ({ default: m.MsalProvider }))
  )
);

const OktaAuthProviderComponent = withSuspenseFallback(
  lazy(() =>
    import('./OktaAuthProvider').then((m) => ({ default: m.OktaAuthProvider }))
  )
);

const BasicAuthProviderComponent = withSuspenseFallback(
  lazy(() => import('./BasicAuthProvider'))
);

interface Auth0ProviderWrapperProps {
  clientId: string;
  domain: string;
  redirectUri: string;
  children: ReactNode;
  useRefreshTokens: boolean;
  cacheLocation?: CacheLocation;
}

export const LazyAuth0ProviderWrapper = ({
  clientId,
  domain,
  redirectUri,
  children,
  useRefreshTokens,
  cacheLocation,
}: Auth0ProviderWrapperProps) => {
  return (
    <Auth0ProviderComponent
      cacheLocation={cacheLocation}
      clientId={clientId}
      domain={domain}
      redirectUri={redirectUri}
      useRefreshTokens={useRefreshTokens}>
      {children}
    </Auth0ProviderComponent>
  );
};

interface MsalProviderWrapperProps {
  instance: IPublicClientApplication;
  children: ReactNode;
}

export const LazyMsalProviderWrapper = ({
  instance,
  children,
}: MsalProviderWrapperProps) => {
  return (
    <MsalProviderComponent instance={instance}>
      {children}
    </MsalProviderComponent>
  );
};

interface OktaAuthProviderWrapperProps {
  children: ReactNode;
}

export const LazyOktaAuthProviderWrapper = ({
  children,
}: OktaAuthProviderWrapperProps) => {
  return <OktaAuthProviderComponent>{children}</OktaAuthProviderComponent>;
};

interface BasicAuthProviderWrapperProps {
  children: ReactNode;
}

export const LazyBasicAuthProviderWrapper = ({
  children,
}: BasicAuthProviderWrapperProps) => {
  return <BasicAuthProviderComponent>{children}</BasicAuthProviderComponent>;
};
