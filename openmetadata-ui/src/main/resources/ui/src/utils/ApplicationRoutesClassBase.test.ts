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
import { render, waitFor } from '@testing-library/react';
import React, { FC } from 'react';
import { UnAuthenticatedAppRouter } from '../components/AppRouter/UnAuthenticatedAppRouter';
import { APP_ROUTER_ROUTES } from '../constants/router.constants';
import applicationRoutesClassBase, {
  ApplicationRoutesClassBase,
} from './ApplicationRoutesClassBase';

jest.mock('../components/AppRouter/AuthenticatedAppRouter', () => ({
  __esModule: true,
  default: function AuthenticatedAppRouter() {
    return React.createElement(
      'div',
      {
        'data-testid': 'authenticated-app-router',
      },
      'Authenticated'
    );
  },
}));

describe('ApplicationRoutesClassBase', () => {
  let instance: ApplicationRoutesClassBase;

  beforeEach(() => {
    instance = new ApplicationRoutesClassBase();
  });

  describe('getRouteElements', () => {
    it('should return a lazy-loaded AuthenticatedAppRouter wrapped with Suspense', async () => {
      const RouterComponent = instance.getRouteElements();

      const { getByTestId } = render(
        React.createElement(RouterComponent, null)
      );

      await waitFor(() => {
        expect(getByTestId('authenticated-app-router')).toBeInTheDocument();
      });
    });

    it('should return the same component reference as the default export', () => {
      const result = instance.getRouteElements();
      const defaultResult = applicationRoutesClassBase.getRouteElements();

      expect(result).toBe(defaultResult);
    });
  });

  describe('getUnAuthenticatedRouteElements', () => {
    it('should return UnAuthenticatedAppRouter', () => {
      const result: FC = instance.getUnAuthenticatedRouteElements();

      expect(result).toBe(UnAuthenticatedAppRouter);
    });
  });

  describe('isProtectedRoute', () => {
    it('should identify protected routes correctly', () => {
      expect(instance.isProtectedRoute('/dashboard')).toBe(true);
      expect(instance.isProtectedRoute('/settings')).toBe(true);
      expect(instance.isProtectedRoute('/explore')).toBe(true);
    });

    it('should identify unprotected routes correctly', () => {
      expect(instance.isProtectedRoute(APP_ROUTER_ROUTES.SIGNIN)).toBe(false);
      expect(instance.isProtectedRoute(APP_ROUTER_ROUTES.SIGNUP)).toBe(false);
      expect(instance.isProtectedRoute(APP_ROUTER_ROUTES.HOME)).toBe(false);
      expect(instance.isProtectedRoute(APP_ROUTER_ROUTES.FORGOT_PASSWORD)).toBe(
        false
      );
      expect(instance.isProtectedRoute(APP_ROUTER_ROUTES.CALLBACK)).toBe(false);
    });
  });
});
