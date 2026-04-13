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

import { FC, lazy } from 'react';
import { UnAuthenticatedAppRouter } from '../components/AppRouter/UnAuthenticatedAppRouter';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import { UNPROTECTED_ROUTES } from '../constants/router.constants';

const AuthenticatedAppRouter = withSuspenseFallback(
  lazy(() => import('../components/AppRouter/AuthenticatedAppRouter'))
);

class ApplicationRoutesClassBase {
  public getRouteElements(): FC {
    return AuthenticatedAppRouter;
  }

  public getUnAuthenticatedRouteElements(): FC {
    return UnAuthenticatedAppRouter;
  }

  public isProtectedRoute(pathname: string): boolean {
    return !UNPROTECTED_ROUTES.has(pathname);
  }
}

const applicationRoutesClass = new ApplicationRoutesClassBase();

export default applicationRoutesClass;

export { ApplicationRoutesClassBase };
