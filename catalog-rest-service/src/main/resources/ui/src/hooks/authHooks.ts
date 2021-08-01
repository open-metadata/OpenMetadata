import { isEmpty } from 'lodash';
import AppState from '../AppState';
import { ROUTES } from '../constants/constants';

export const useAuth = (pathname = '') => {
  const { authDisabled, userDetails, newUser, authProvider } = AppState;
  const isAuthenticatedRoute =
    pathname !== ROUTES.SIGNUP &&
    pathname !== ROUTES.SIGNIN &&
    pathname !== ROUTES.CALLBACK;

  return {
    isSigningIn: authProvider.signingIn,
    isSignedIn: authDisabled || !isEmpty(userDetails),
    isSigningUp: !authDisabled && !isEmpty(newUser),
    isSignedOut:
      !authDisabled &&
      !authProvider.signingIn &&
      isEmpty(userDetails) &&
      isEmpty(newUser),
    isAuthenticatedRoute: isAuthenticatedRoute,
  };
};
