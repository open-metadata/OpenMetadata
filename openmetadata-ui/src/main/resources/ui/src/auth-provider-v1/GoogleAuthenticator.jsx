import PropTypes from 'prop-types';
import { forwardRef, useImperativeHandle } from 'react';
import { useGoogleLogin, useGoogleLogout } from 'react-google-login';
import { useAuthContext } from '../auth-provider-v1/AuthProviderV1';
import { refreshTokenSetup } from '../auth-provider-v1/refreshToken';
import { oidcTokenKey } from '../constants/constants';

const GoogleAuthenticator = forwardRef(
  ({ children, onLoginSuccess, onLogoutSuccess }, ref) => {
    const { authConfig, setIsAuthenticated } = useAuthContext();

    const googleClientLogin = useGoogleLogin({
      clientId: authConfig.clientId,
      onSuccess: (res) => {
        const { tokenObj, profileObj } = res;
        const user = {
          // eslint-disable-next-line @typescript-eslint/camelcase
          id_token: tokenObj.id_token,
          scope: tokenObj.scope,
          profile: {
            email: profileObj.email,
            name: profileObj.name,
            picture: profileObj.imageUrl,
          },
        };
        // eslint-disable-next-line no-console
        console.log('Login Success: currentUser:', res);
        setIsAuthenticated(true);
        localStorage.setItem(oidcTokenKey, tokenObj.id_token);
        refreshTokenSetup(res);
        onLoginSuccess(user);
      },
      onFailure: (res) => {
        // eslint-disable-next-line no-console
        console.log('Login failed: res:', res);
      },
      cookiePolicy: 'single_host_origin',
      isSignedIn: true,
    });

    const googleClientLogout = useGoogleLogout({
      clientId: authConfig.clientId,
      onLogoutSuccess: (res) => {
        // eslint-disable-next-line no-console
        console.log('Logout Success: currentUser:', res);
        setIsAuthenticated(false);
        onLogoutSuccess();
      },
      onFailure: (res) => {
        // eslint-disable-next-line no-console
        console.log('Logout failed: res:', res);
      },
      cookiePolicy: 'single_host_origin',
    });

    useImperativeHandle(ref, () => ({
      invokeLogin() {
        googleClientLogin.signIn();
      },
      invokeLogout() {
        googleClientLogout.signOut();
      },
    }));

    return children;
  }
);

GoogleAuthenticator.propTypes = {
  children: PropTypes.node,
  onLoginSuccess: PropTypes.func,
  onLogoutSuccess: PropTypes.func,
};

GoogleAuthenticator.displayName = 'GoogleAuthenticator';

export default GoogleAuthenticator;
