/*
 *  Copyright 2026 Collate.
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
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { useProductTourStore } from '../../../../hooks/product-tour/useProductTourStore';
import { AppModule } from '../../../../interface/app-module.interface';
import ProductTourPage from '../../../../pages/product-tour/ProductTourPage/ProductTourPage';
import { queryClient } from '../../../../queryClient';
import { getInstalledApplicationList } from '../../../../rest/applicationAPI';
import leftSidebarClassBase from '../../../../utils/LeftSidebarClassBase';
import ApplicationsProvider from '../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { AppModeRoutes } from './AppModeRoutes';

// The route cache, the tour store and the query client are the real ones:
// only the app's surroundings are stubbed.
jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: { app: {} } }),
}));
const mockApplicationStore = {
  setApplicationsName: jest.fn(),
  setApplicationsLoaded: jest.fn(),
};
jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => mockApplicationStore,
}));
jest.mock('../../../../rest/applicationAPI', () => ({
  getInstalledApplicationList: jest.fn(),
}));
jest.mock('../../../../hooks/useAppMode', () => ({
  ...jest.requireActual('../../../../hooks/useAppMode'),
  useAppMode: () => 'ai',
}));
jest.mock('../../../../utils/ProductTourClassBase', () => ({
  __esModule: true,
  default: {
    getTour: () => ({ mode: 'ai', steps: [], loadFixtures: async () => [] }),
  },
}));
jest.mock('../../../common/DocumentTitle/DocumentTitle', () => () => null);
jest.mock('../AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('../AINotFoundPage/AINotFoundPage', () => () => null);
jest.mock('../../../../utils/ApplicationRoutesClassBase', () => ({
  __esModule: true,
  default: {
    getRouteElements: () => () =>
      (
        <Routes>
          <Route element={<ProductTourPage />} path="/tour" />
        </Routes>
      ),
  },
}));

const HOME_QUERY_KEY = ['pre-tour-home'];

const HomePage = () => {
  const { data } = useQuery({
    queryKey: HOME_QUERY_KEY,
    queryFn: async () => 'server data',
  });

  return <p>{data}</p>;
};

const HOME_MODULE: AppModule = {
  id: 'home',
  navOrder: 0,
  labelKey: 'label.home',
  prefix: '/',
  defaultPath: '/',
  routes: [{ path: '/', element: <HomePage /> }],
};

let navigateTo: (path: string) => void;

const NavigationHandle = () => {
  navigateTo = useNavigate();

  return null;
};

describe('AppModeRoutes — product tour', () => {
  const originalModules = leftSidebarClassBase.getAppModeModules();

  beforeEach(() => {
    leftSidebarClassBase.setAppModeModules([HOME_MODULE]);
    (getInstalledApplicationList as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    useProductTourStore.getState().exit();
    queryClient.clear();
    leftSidebarClassBase.setAppModeModules(originalModules);
  });

  it('opens the tour without the pages, or the data, from before it', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/']}>
          <ApplicationsProvider>
            <AppModeRoutes />
            <NavigationHandle />
          </ApplicationsProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('server data')).toBeInTheDocument();

    act(() => navigateTo('/tour'));

    expect(useProductTourStore.getState().isActive).toBe(true);
    expect(screen.queryByText('server data')).not.toBeInTheDocument();
    expect(
      queryClient.getQueryCache().find({ queryKey: HOME_QUERY_KEY })
    ).toBeUndefined();
  });
});
