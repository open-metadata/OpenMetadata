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

import { FC } from 'react';
import AuthenticatedAppRouter from '../components/AppRouter/AuthenticatedAppRouter';
import { UnAuthenticatedAppRouter } from '../components/AppRouter/UnAuthenticatedAppRouter';
import { ROUTES } from '../constants/constants';

class ApplicationRoutesClassBase {
  public getRouteElements(): FC {
    return AuthenticatedAppRouter;
  }

  public getUnAuthenticatedRouteElements(): FC {
    return UnAuthenticatedAppRouter;
  }

  public isProtectedRoute(pathname: string): boolean {
    return (
      [
        ROUTES.SIGNUP,
        ROUTES.SIGNIN,
        ROUTES.FORGOT_PASSWORD,
        ROUTES.CALLBACK,
        ROUTES.SILENT_CALLBACK,
        ROUTES.SAML_CALLBACK,
        ROUTES.REGISTER,
        ROUTES.RESET_PASSWORD,
        ROUTES.ACCOUNT_ACTIVATION,
        ROUTES.HOME,
        ROUTES.AUTH_CALLBACK,
        ROUTES.NOT_FOUND,
        ROUTES.LOGOUT,
      ].indexOf(pathname) === -1
    );
  }
}

const applicationRoutesClass = new ApplicationRoutesClassBase();

export default applicationRoutesClass;

export { ApplicationRoutesClassBase };
