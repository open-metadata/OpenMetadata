import {
  InteractionRequiredAuthError,
  InteractionStatus,
} from '@azure/msal-browser';
import { useAccount, useIsAuthenticated, useMsal } from '@azure/msal-react';
// import PropTypes from 'prop-types';
import React, {
  forwardRef,
  Fragment,
  ReactNode,
  useEffect,
  useImperativeHandle,
} from 'react';
// import { useHistory } from 'react-router-dom';
import { oidcTokenKey, ROUTES } from '../constants/constants';
import { msalLoginRequest } from '../utils/AuthProvider.util';
import { useAuthContext } from './AuthProviderV1';
import { AuthenticatorRef, OidcUser } from './AuthProviderV1.interface';

interface Props {
  children: ReactNode;
  onLoginSuccess: (user: OidcUser) => void;
  onLogoutSuccess: () => void;
}

export type Ref = ReactNode | HTMLElement | string;

const MsalAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children, onLoginSuccess, onLogoutSuccess }: Props, ref) => {
    const { setIsAuthenticated } = useAuthContext();
    const { instance, accounts, inProgress } = useMsal();
    const isMsalAuthenticated = useIsAuthenticated();
    const account = useAccount(accounts[0] || {});

    const handleOnLogoutSucess = () => {
      for (const key in localStorage) {
        if (key.includes('-login.windows.net-') || key.startsWith('msal.')) {
          localStorage.removeItem(key);
        }
      }
      onLogoutSuccess();
    };

    const login = (loginType = 'popup') => {
      if (loginType === 'popup') {
        instance.loginPopup(msalLoginRequest);
      } else if (loginType === 'redirect') {
        instance.loginRedirect(msalLoginRequest);
      }
    };
    const logout = (logoutType = 'popup') => {
      if (logoutType === 'popup') {
        instance
          .logoutPopup({
            mainWindowRedirectUri: ROUTES.HOME,
          })
          .then(() => {
            handleOnLogoutSucess();
          });
      } else if (logoutType === 'redirect') {
        instance.logoutRedirect().then(() => {
          handleOnLogoutSucess();
        });
      }
    };

    useEffect(() => {
      const oidcUserToken = localStorage.getItem(oidcTokenKey);
      if (
        !oidcUserToken &&
        inProgress === InteractionStatus.None &&
        (accounts.length > 0 || account?.idTokenClaims)
      ) {
        const tokenRequest = {
          account: account || accounts[0], // This is an example - Select account based on your app's requirements
          scopes: msalLoginRequest.scopes,
        };

        // Acquire an access token
        instance
          .acquireTokenSilent(tokenRequest)
          .then((response) => {
            // Call your API with the access token and return the data you need to save in state
            // eslint-disable-next-line no-console
            console.log(response);
            const { idToken, scopes, account } = response;
            const user = {
              // eslint-disable-next-line @typescript-eslint/camelcase
              id_token: idToken,
              scope: scopes.join(),
              profile: {
                email: account?.username || '',
                name: account?.name || '',
                picture: '',
              },
            };
            setIsAuthenticated(isMsalAuthenticated);
            localStorage.setItem(oidcTokenKey, idToken);
            //   refreshTokenSetup(res);
            onLoginSuccess(user);
          })
          .catch(async (e) => {
            // Catch interaction_required errors and call interactive method to resolve
            if (e instanceof InteractionRequiredAuthError) {
              await instance.acquireTokenRedirect(tokenRequest);
            }

            throw e;
          });
      }
    }, [inProgress, accounts, instance, account]);

    useImperativeHandle(ref, () => ({
      invokeLogin() {
        login();
      },
      invokeLogout() {
        logout();
      },
    }));

    return <Fragment>{children}</Fragment>;
  }
);

MsalAuthenticator.displayName = 'MsalAuthenticator';

export default MsalAuthenticator;
