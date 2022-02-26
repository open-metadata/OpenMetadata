import { useOktaAuth } from '@okta/okta-react';
// import PropTypes from 'prop-types';
import React, {
  forwardRef,
  Fragment,
  ReactNode,
  useEffect,
  useImperativeHandle,
} from 'react';
import { useHistory } from 'react-router-dom';
import { ROUTES } from '../constants/constants';
import { useAuthContext } from './AuthProviderV1';
import { AuthenticatorRef } from './AuthProviderV1.interface';

interface Props {
  children: ReactNode;
  onLogoutSuccess: () => void;
}

export type Ref = ReactNode | HTMLElement | string;

const OktaAuthenticator = forwardRef<AuthenticatorRef, Props>(
  ({ children, onLogoutSuccess }: Props, ref) => {
    const { authState, oktaAuth } = useOktaAuth();
    const { setIsAuthenticated } = useAuthContext();
    const history = useHistory();

    const login = async () => {
      oktaAuth.signInWithRedirect();
    };

    const logout = async () => {
      const basename =
        window.location.origin +
        history.createHref({ pathname: ROUTES.SIGNIN });
      setIsAuthenticated(false);
      try {
        if (localStorage.getItem('okta-token-storage')) {
          await oktaAuth.signOut({ postLogoutRedirectUri: basename });
        }
        localStorage.removeItem('okta-token-storage');
        onLogoutSuccess();
      } catch (err) {
        // if (isCorsError(err)) {
        //   setCorsErrorModalOpen(true);
        // } else {
        //   throw err;
        // }
      }
    };

    // const loginUser = async () => {
    //   try {
    //     const info = await oktaAuth.getUser();
    //     // setUserInfo(info);
    //     // eslint-disable-next-line no-console
    //     console.log(info);
    //     const user = {
    //       // eslint-disable-next-line @typescript-eslint/camelcase
    //       id_token: authState.idToken.idToken,
    //       scope: authState.idToken.scopes.join(),
    //       profile: {
    //         email: info.email,
    //         name: info.name,
    //         picture: info.imageUrl || '',
    //         locale: info.locale || '',
    //       },
    //     };
    //     onLoginSuccess(user);
    //   } catch (err) {
    //     // eslint-disable-next-line no-console
    //     console.error(err);
    //   }
    // };

    useEffect(() => {
      if (!authState || !authState.isAuthenticated) {
        // When user isn't authenticated, forget any user info
        // setUserInfo(null);
        // logout();
      } else {
        // const oidcUserToken = localStorage.getItem(oidcTokenKey);
        // if (!oidcUserToken) {
        //   setIsAuthenticated(true);
        //   localStorage.setItem(oidcTokenKey, authState.idToken.idToken);
        //   loginUser();
        // } else if (oidcUserToken !== authState.idToken.idToken) {
        //   setIsAuthenticated(true);
        //   localStorage.setItem(oidcTokenKey, authState.idToken.idToken);
        // }
      }
    }, [authState, oktaAuth]); // Update if authState changes

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

// OktaAuthenticator.propTypes = {
//   children: PropTypes.node,
//   onLogoutSuccess: PropTypes.func.isRequired,
// };

OktaAuthenticator.displayName = 'OktaAuthenticator';

export default OktaAuthenticator;
