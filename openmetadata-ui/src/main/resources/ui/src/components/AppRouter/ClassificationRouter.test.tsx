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
import ClassificationRouter from './ClassificationRouter';

jest.mock('./AdminProtectedRoute', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children }) => children),
}));

jest.mock('../../utils/PermissionsUtils', () => {
  return {
    userPermissions: {
      hasViewPermissions: jest.fn(() => true),
    },
  };
});

jest.mock(
  '../../pages/ClassificationVersionPage/ClassificationVersionPage',
  () => {
    return jest.fn().mockImplementation(() => <>ClassificationVersionPage</>);
  }
);

jest.mock('../../pages/TagsPage/TagsPage', () => {
  return jest.fn().mockImplementation(() => <>TagsPage</>);
});

describe('ClassificationRouter', () => {
  it('should render TagsPage component when route matches "/tags" or "/tags/:tagId"', async () => {
    render(
      <MemoryRouter initialEntries={['', '/testTag']}>
        <ClassificationRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('TagsPage')).toBeInTheDocument();
  });

  it('should render ClassificationVersionPage component when route matches "/tags/version"', async () => {
    render(
      <MemoryRouter initialEntries={['/testTag/versions/123']}>
        <ClassificationRouter />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('ClassificationVersionPage')
    ).toBeInTheDocument();
  });
});
