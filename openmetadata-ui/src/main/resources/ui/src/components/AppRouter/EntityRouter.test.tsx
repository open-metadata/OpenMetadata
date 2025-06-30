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
import { MemoryRouter } from 'react-router-dom';
import { useRequiredParams } from '../../utils/useRequiredParams';
import EntityRouter from './EntityRouter';

jest.mock('../../pages/EntityVersionPage/EntityVersionPage.component', () => {
  return jest.fn(() => <div>EntityVersionPage</div>);
});

jest.mock('../../utils/ApplicationRoutesClassBase', () => {
  return {
    getRouteElements: jest.fn(() => null),
  };
});

jest.mock('../../utils/EntityUtilClassBase', () => ({
  getEntityDetailComponent: jest.fn().mockImplementation((entityType) => {
    if (entityType === 'table') {
      return () => <>EntityDetails</>;
    }

    return null;
  }),
}));

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => ({
    entityType: 'table',
  })),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Navigate: jest.fn(({ to }) => <div>Redirected to {to}</div>),
}));

describe('EntityRouter', () => {
  it('should render EntityVersionPage component for entity version details route', async () => {
    render(
      <MemoryRouter initialEntries={['/testTable/versions/123']}>
        <EntityRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('EntityVersionPage')).toBeInTheDocument();
  });

  it('should render EntityVersionPage component for entity version details route with tab', async () => {
    render(
      <MemoryRouter initialEntries={['/testTable/versions/123/all']}>
        <EntityRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('EntityVersionPage')).toBeInTheDocument();
  });

  it('should render EntityDetails component for entity details route', async () => {
    render(
      <MemoryRouter initialEntries={['/testTable']}>
        <EntityRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('EntityDetails')).toBeInTheDocument();
  });

  it('should render EntityDetails component for entity details route with tab', async () => {
    render(
      <MemoryRouter initialEntries={['/testTable/schema']}>
        <EntityRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('EntityDetails')).toBeInTheDocument();
  });

  it('should render EntityDetails component for entity details route with tab & subtab', async () => {
    render(
      <MemoryRouter initialEntries={['/testTable/activity_feed/tasks']}>
        <EntityRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('EntityDetails')).toBeInTheDocument();
  });

  it('should render NotFound component for unknown route', () => {
    (useRequiredParams as jest.Mock).mockReturnValue({
      entityType: 'unknown',
    });

    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <EntityRouter />
      </MemoryRouter>
    );

    expect(screen.getByText('Redirected to /404')).toBeInTheDocument();
  });
});
