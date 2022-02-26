// import PropTypes from 'prop-types';
import React, {
  forwardRef,
  Fragment,
  ReactNode,
  useImperativeHandle,
} from 'react';
import {
  GoogleLoginResponse,
  useGoogleLogin,
  useGoogleLogout,
} from 'react-google-login';
import { oidcTokenKey } from '../constants/constants';
import { useAuthContext } from './AuthProviderV1';
import { AuthenticatorRef, OidcUser } from './AuthProviderV1.interface';
import { refreshTokenSetup } from './refreshToken';

interface Props {
  children: ReactNode;
  onLoginSuccess: (user: OidcUser) => void;
  onLogoutSuccess: () => void;
}

const GoogleAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children, onLoginSuccess, onLogoutSuccess }: Props, ref) => {
    const { authConfig, setIsAuthenticated } = useAuthContext();

    const googleClientLogin = useGoogleLogin({
      clientId: authConfig.clientId,
      onSuccess: (res) => {
        const { tokenObj, profileObj } = res as GoogleLoginResponse;
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
      onLogoutSuccess: () => {
        // eslint-disable-next-line no-console
        console.log('Logout Success!');
        setIsAuthenticated(false);
        onLogoutSuccess();
      },
      onFailure: () => {
        // eslint-disable-next-line no-console
        console.log('Logout failed!');
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

    return <Fragment>{children}</Fragment>;
  }
);

// GoogleAuthenticator.propTypes = {
//   children: PropTypes.node,
//   onLoginSuccess: PropTypes.func,
//   onLogoutSuccess: PropTypes.func,
// };

GoogleAuthenticator.displayName = 'GoogleAuthenticator';

export default GoogleAuthenticator;
