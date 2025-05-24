/*
 *  Copyright 2024 Collate.
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
import { forwardRef, Fragment, ReactNode, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { logoutUser, renewToken } from '../../../rest/LoginAPI';
import TokenService from '../../../utils/Auth/TokenService/TokenServiceUtil';
import { setOidcToken } from '../../../utils/LocalStorageUtils';

export const GenericAuthenticator = forwardRef(
  ({ children }: { children: ReactNode }, ref) => {
    const { setIsAuthenticated, setIsSigningUp } = useApplicationStore();
    const navigate = useNavigate();

    const handleLogin = () => {
      setIsAuthenticated(false);
      setIsSigningUp(true);
      const redirectUri = `${window.location.origin}${ROUTES.AUTH_CALLBACK}`;
      window.location.assign(`api/v1/auth/login?redirectUri=${redirectUri}`);
    };

    const handleLogout = async () => {
      await logoutUser();

      TokenService.getInstance().clearRefreshInProgress();
      navigate(ROUTES.SIGNIN);
      setOidcToken('');
      setIsAuthenticated(false);
    };

    const handleSilentSignIn = async () => {
      const resp = await renewToken();
      setOidcToken(resp.accessToken);

      return resp;
    };

    useImperativeHandle(ref, () => ({
      invokeLogout: handleLogout,
      renewIdToken: handleSilentSignIn,
      invokeLogin: handleLogin,
    }));

    return <Fragment>{children}</Fragment>;
  }
);
