import { AxiosError } from 'axios';
import { JwtPayload } from 'jwt-decode';
import React, { createContext, ReactNode, useContext, useState } from 'react';
import { useHistory } from 'react-router-dom';
import appState from '../../AppState';
import {
  basicAuthRegister,
  basicAuthSignIn,
  checkEmailInUse,
  generatePasswordResetLink,
  resetPassword,
} from '../../axiosAPIs/auth-API';
import { getUserByName } from '../../axiosAPIs/userAPI';
import { HTTP_STATUS_CODE } from '../../constants/auth.constants';
import { ROUTES } from '../../constants/constants';
import { PasswordResetRequest } from '../../generated/auth/passwordResetRequest';
import { RegistrationRequest } from '../../generated/auth/registrationRequest';
import jsonData from '../../jsons/en';
import { getNameFromEmail } from '../../utils/AuthProvider.util';
import localState from '../../utils/LocalStorageUtils';
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from '../../utils/ToastUtils';
import { useAuthContext } from './AuthProvider';

export interface JWTPayloadV1 extends JwtPayload {
  isBot?: false;
  email?: string;
}

interface BasicAuthProps {
  children: ReactNode;
}

interface InitialContext {
  handleLogin: (email: string, password: string) => void;
  handleRegister: (payload: RegistrationRequest) => void;
  handleForgotPassword: (email: string) => void;
  handleResetPassword: (payload: PasswordResetRequest) => void;
  handleLogout: () => void;
  isPasswordResetLinkSent: boolean;
  isUserCreated: boolean;
  isResetTokenExpired: boolean;
}

/**
 * @ignore
 */
const stub = (): never => {
  throw new Error('You forgot to wrap your component in <BasicAuthProvider>.');
};

const initialContext = {
  handleLogin: stub,
  handleRegister: stub,
  handleForgotPassword: stub,
  handleResetPassword: stub,
  handleLogout: stub,
  isPasswordResetLinkSent: false,
  isUserCreated: false,
  isResetTokenExpired: false,
};

const userAPIQueryFields = 'profile,teams,roles';

const BasicAuthProvider = ({ children }: BasicAuthProps) => {
  const [isPasswordResetLinkSent, setIsPasswordResetLinkSent] = useState(false);
  const [isUserCreated, setIsUserCreated] = useState(false);
  const [isResetTokenExpired, setIsResetTokenExpired] = useState(false);

  const {
    setIsAuthenticated,
    setIsAuthDisabled,
    setLoadingIndicator,
    setIsSigningIn,
  } = useAuthContext();

  const history = useHistory();

  const handleLogin = async (email: string, password: string) => {
    try {
      setLoadingIndicator(true);
      const isEmailAlreadyExists = await checkEmailInUse(email);
      if (isEmailAlreadyExists) {
        const response = await basicAuthSignIn({ email, password });

        if (response.accessToken) {
          localState.setRefreshToken(response.refreshToken);
          localState.setOidcToken(response.accessToken);

          const userProfile = await getUserByName(
            getNameFromEmail(email),
            userAPIQueryFields
          );

          if (userProfile) {
            setIsAuthenticated(true);
            appState.updateUserDetails(userProfile);
            setIsSigningIn(true);
          }
        }
      } else {
        showErrorToast(jsonData['api-error-messages']['email-not-found']);
      }
    } catch (err) {
      setIsAuthDisabled(true);
      showErrorToast(
        err as AxiosError,
        jsonData['api-error-messages']['unauthorized-user']
      );
    } finally {
      setLoadingIndicator(false);
    }
  };

  const handleRegister = async (request: RegistrationRequest) => {
    try {
      const isEmailAlreadyExists = await checkEmailInUse(request.email);
      if (!isEmailAlreadyExists) {
        setLoadingIndicator(true);
        const response = await basicAuthRegister(request);

        if (response === HTTP_STATUS_CODE.SUCCESS) {
          setIsUserCreated(true);
          showSuccessToast(
            jsonData['api-success-messages']['create-user-account']
          );
          showInfoToast(jsonData['label']['email-confirmation']);
          history.push(ROUTES.SIGNIN);
        } else {
          return showErrorToast(
            jsonData['api-error-messages']['unexpected-server-response']
          );
        }
      } else {
        return showErrorToast(jsonData['api-error-messages']['email-found']);
      }
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        jsonData['api-error-messages']['unexpected-server-response']
      );
    } finally {
      setLoadingIndicator(false);
    }
  };

  const handleForgotPassword = async (email: string) => {
    try {
      setLoadingIndicator(true);
      const response = await generatePasswordResetLink(email);

      if (response === HTTP_STATUS_CODE.SUCCESS) {
        setIsPasswordResetLinkSent(true);
      }
    } catch (err) {
      setIsPasswordResetLinkSent(false);
      showErrorToast(jsonData['api-error-messages']['email-not-found']);
    } finally {
      setLoadingIndicator(false);
    }
  };

  const handleResetPassword = async (payload: PasswordResetRequest) => {
    try {
      setLoadingIndicator(true);

      const response = await resetPassword(payload);
      if (response) {
        showSuccessToast(
          jsonData['api-success-messages']['reset-password-success']
        );
      }
    } catch (err) {
      setIsResetTokenExpired(true);
      showErrorToast(
        err as AxiosError,
        jsonData['api-error-messages']['unexpected-server-response']
      );
    } finally {
      setLoadingIndicator(false);
    }
  };

  const handleLogout = async () => {
    localState.removeOidcToken();

    history.push(ROUTES.SIGNIN);
  };

  const contextValue = {
    handleLogin,
    handleRegister,
    handleForgotPassword,
    handleResetPassword,
    handleLogout,
    isResetTokenExpired,
    isPasswordResetLinkSent,
    isUserCreated,
  };

  return (
    <BasicAuthContext.Provider value={contextValue}>
      {children}
    </BasicAuthContext.Provider>
  );
};

/**
 * The Basic Auth Context
 */
export const BasicAuthContext = createContext<InitialContext>(initialContext);

export const useBasicAuth = () => useContext(BasicAuthContext);

export default BasicAuthProvider;
