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
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import EntityRouter from './EntityRouter';

jest.mock('../../pages/EntityVersionPage/EntityVersionPage.component', () => {
  return jest.fn(() => <div>EntityVersionPage</div>);
});

jest.mock('../../utils/ApplicationRoutesClassBase', () => {
  return {
    getRouteElements: jest.fn(() => null),
  };
});

jest.mock('../../utils/EntityUtilClassBase', () => {
  return {
    getEntityDetailComponent: jest.fn((entityType) => {
      return entityType === 'table' ? () => <>EntityDetails</> : null;
    }),
  };
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Redirect: jest.fn(({ to }) => `Redirected to ${to}`),
}));

describe('EntityRouter', () => {
  it('should render EntityVersionPage component for entity version details route', async () => {
    render(
      <MemoryRouter initialEntries={['/table/testTable/versions/123']}>
        <Route path="/:entityType">
          <EntityRouter />
        </Route>
      </MemoryRouter>
    );

    expect(await screen.findByText('EntityVersionPage')).toBeInTheDocument();
  });

  it('should render EntityVersionPage component for entity version details route with tab', async () => {
    render(
      <MemoryRouter initialEntries={['/table/testTable/versions/123/all']}>
        <Route path="/:entityType">
          <EntityRouter />
        </Route>
      </MemoryRouter>
    );

    expect(await screen.findByText('EntityVersionPage')).toBeInTheDocument();
  });

  it('should render EntityDetails component for entity details route', async () => {
    render(
      <MemoryRouter initialEntries={['/table/testTable']}>
        <Route path="/:entityType">
          <EntityRouter />
        </Route>
      </MemoryRouter>
    );

    expect(await screen.findByText('EntityDetails')).toBeInTheDocument();
  });

  it('should render EntityDetails component for entity details route with tab', async () => {
    render(
      <MemoryRouter initialEntries={['/table/testTable/schema']}>
        <Route path="/:entityType">
          <EntityRouter />
        </Route>
      </MemoryRouter>
    );

    expect(await screen.findByText('EntityDetails')).toBeInTheDocument();
  });

  it('should render EntityDetails component for entity details route with tab & subtab', async () => {
    render(
      <MemoryRouter initialEntries={['/table/testTable/activity_feed/tasks']}>
        <Route path="/:entityType">
          <EntityRouter />
        </Route>
      </MemoryRouter>
    );

    expect(await screen.findByText('EntityDetails')).toBeInTheDocument();
  });

  it('should render NotFound component for unknown route', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <Route path="/:entityType">
          <EntityRouter />
        </Route>
      </MemoryRouter>
    );

    expect(screen.getByText(`Redirected to /404`)).toBeInTheDocument();
  });
});
