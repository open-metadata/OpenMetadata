import { OktaAuth } from '@okta/okta-auth-js';
import { Security } from '@okta/okta-react';
import PropTypes from 'prop-types';
import React from 'react';
import { oidcTokenKey } from '../constants/constants';
import { useAuthContext } from './AuthProviderV1';

export const OktaAuthProvider = ({ children, onLoginSuccess }) => {
  const { authConfig, setIsAuthenticated } = useAuthContext();
  const { clientId, issuer, redirectUri, scopes, pkce } = authConfig;
  const oktaAuth = new OktaAuth({
    clientId,
    issuer,
    redirectUri,
    scopes,
    pkce,
  });
  // const history = useHistory();

  const triggerLogin = async () => {
    await oktaAuth.signInWithRedirect();
  };

  const restoreOriginalUri = async (_oktaAuth /* , _originalUri */) => {
    // history.replace(toRelativeUrl(originalUri || '/', window.location.origin));
    const { idToken } = _oktaAuth?.authStateManager?._authState;
    localStorage.setItem(oidcTokenKey, idToken?.idToken || '');
    _oktaAuth
      .getUser()
      .then((info) => {
        // eslint-disable-next-line no-console
        console.log(info);
        setIsAuthenticated(true);
        const user = {
          // eslint-disable-next-line @typescript-eslint/camelcase
          id_token: idToken.idToken,
          scope: idToken.scopes.join(),
          profile: {
            email: info.email,
            name: info.name,
            picture: info.imageUrl || '',
            locale: info.locale || '',
          },
        };
        onLoginSuccess(user);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error(err);
      });

    return;
  };

  const customAuthHandler = async () => {
    const previousAuthState = oktaAuth.authStateManager.getPreviousAuthState();
    if (!previousAuthState || !previousAuthState.isAuthenticated) {
      // App initialization stage
      await triggerLogin();
    } else {
      // Ask the user to trigger the login process during token autoRenew process
      //   setAuthRequiredModalOpen(true);
    }
  };

  return (
    <Security
      oktaAuth={oktaAuth}
      restoreOriginalUri={restoreOriginalUri}
      onAuthRequired={customAuthHandler}>
      {children}
    </Security>
  );
};

OktaAuthProvider.propTypes = {
  children: PropTypes.node,
  onLoginSuccess: PropTypes.func,
};

export default OktaAuthProvider;
