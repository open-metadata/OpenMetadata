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

import {
  InteractionRequiredAuthError,
  InteractionStatus,
} from '@azure/msal-browser';
import { useAccount, useMsal } from '@azure/msal-react';
import {
  forwardRef,
  Fragment,
  ReactNode,
  useEffect,
  useImperativeHandle,
} from 'react';
import {
  msalLoginRequest,
  parseMSALResponse,
} from '../../../utils/AuthProvider.util';
import { getPopupSettingLink } from '../../../utils/BrowserUtils';
import { Transi18next } from '../../../utils/CommonUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import { useAuthProvider } from '../AuthProviders/AuthProvider';
import {
  AuthenticatorRef,
  OidcUser,
} from '../AuthProviders/AuthProvider.interface';
interface Props {
  children: ReactNode;
}

const MsalAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children }: Props, ref) => {
    const { instance, accounts, inProgress } = useMsal();
    const account = useAccount(accounts[0] || {});
    const { handleSuccessfulLogin, handleFailedLogin, handleSuccessfulLogout } =
      useAuthProvider();

    const login = async () => {
      try {
        const isInIframe = window.self !== window.top;

        if (isInIframe) {
          // Use popup login when in iframe to avoid redirect issues
          const response = await instance.loginPopup(msalLoginRequest);

          handleSuccessfulLogin(parseMSALResponse(response));
        } else {
          // Use login with redirect for normal window context
          await instance.loginRedirect(msalLoginRequest);
        }
      } catch {
        handleFailedLogin();
      }
    };

    const logout = async () => {
      try {
        for (const key in localStorage) {
          if (key.includes('-login.windows.net-') || key.startsWith('msal.')) {
            localStorage.removeItem(key);
          }
        }
      } finally {
        // Cleanup application state
        handleSuccessfulLogout();
      }
    };

    const fetchIdToken = async (
      shouldFallbackToPopup = false
    ): Promise<OidcUser> => {
      const tokenRequest = {
        account: account || accounts[0], // This is an example - Select account based on your app's requirements
        scopes: msalLoginRequest.scopes,
      };
      try {
        const response = await instance.ssoSilent(tokenRequest);

        return parseMSALResponse(response);
      } catch (error) {
        if (
          error instanceof InteractionRequiredAuthError &&
          shouldFallbackToPopup
        ) {
          const response = await instance
            .loginPopup(tokenRequest)
            .catch((e) => {
              // eslint-disable-next-line no-console
              console.error(e);
              if (e?.message?.includes('popup_window_error')) {
                showErrorToast(
                  <Transi18next
                    i18nKey="message.popup-block-message"
                    renderElement={
                      <a
                        href={getPopupSettingLink()}
                        rel="noopener noreferrer"
                        target="_blank"
                      />
                    }
                  />
                );
              }

              throw e;
            });

          return parseMSALResponse(response);
        } else {
          // eslint-disable-next-line no-console
          console.error(error);

          throw error;
        }
      }
    };

    const renewIdToken = async () => {
      const user = await fetchIdToken();

      return user.id_token;
    };

    useImperativeHandle(ref, () => ({
      invokeLogin: login,
      invokeLogout: logout,
      renewIdToken: renewIdToken,
    }));

    // Need to capture redirect and parse ID token
    // Call login success callback
    const handleRedirect = async () => {
      try {
        const response = await instance.handleRedirectPromise();

        if (response) {
          const user = parseMSALResponse(response);

          handleSuccessfulLogin(user);
        }
      } catch {
        handleFailedLogin();
      }
    };

    // To add redirect callback
    useEffect(() => {
      instance && handleRedirect();
    }, [instance]);

    // Show loader until the interaction is completed
    if (inProgress !== InteractionStatus.None) {
      return <Loader />;
    }

    return <Fragment>{children}</Fragment>;
  }
);

MsalAuthenticator.displayName = 'MsalAuthenticator';

export default MsalAuthenticator;
