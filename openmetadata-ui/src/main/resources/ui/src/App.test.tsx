/*
 *  Copyright 2022 Collate.
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

import { render } from '@testing-library/react';
import React from 'react';
import App from './App';
import AppRouter from './components/AppRouter/AppRouter';
import { useApplicationStore } from './hooks/useApplicationStore';
import { idlePrefetchRoutes } from './utils/idlePrefetchRoutes';

const mockAuthProvider = jest.fn();

let mockIsAuthenticated = false;

jest.mock('./utils/idlePrefetchRoutes', () => ({
  idlePrefetchRoutes: jest.fn(),
}));

jest.mock('./hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn((selector) =>
    selector({ isAuthenticated: mockIsAuthenticated })
  ),
}));

jest.mock('./components/AppRouter/AppRouter', () => ({
  __esModule: true,
  default: function AppRouter() {
    return React.createElement(
      'div',
      { 'data-testid': 'app-router' },
      'AppRouter'
    );
  },
}));

jest.mock('./components/Auth/AuthProviders/AuthProvider', () => ({
  AuthProvider: function AuthProvider({
    children,
    childComponentType,
  }: {
    children: React.ReactNode;
    childComponentType: React.ComponentType;
  }) {
    mockAuthProvider({ childComponentType });

    return React.createElement(
      'div',
      { 'data-testid': 'auth-provider' },
      children
    );
  },
}));

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = false;
  });

  it('should render AuthProvider wrapping AppRouter', () => {
    const { getByTestId } = render(React.createElement(App));

    expect(getByTestId('auth-provider')).toBeInTheDocument();
    expect(getByTestId('app-router')).toBeInTheDocument();
  });

  it('should pass AppRouter as childComponentType to AuthProvider', () => {
    render(React.createElement(App));

    expect(mockAuthProvider).toHaveBeenCalledWith({
      childComponentType: AppRouter,
    });
  });

  it('should not prefetch route chunks on the unauthenticated shell', () => {
    mockIsAuthenticated = false;

    render(React.createElement(App));

    expect(idlePrefetchRoutes).not.toHaveBeenCalled();
  });

  it('should prefetch route chunks once authenticated', () => {
    mockIsAuthenticated = true;

    render(React.createElement(App));

    expect(idlePrefetchRoutes).toHaveBeenCalledTimes(1);
  });

  it('should read isAuthenticated from the application store', () => {
    render(React.createElement(App));

    expect(useApplicationStore).toHaveBeenCalled();
  });
});
