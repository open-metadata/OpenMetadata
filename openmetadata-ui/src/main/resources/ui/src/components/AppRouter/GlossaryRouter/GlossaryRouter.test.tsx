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
import GlossaryRouter from './GlossaryRouter';

jest.mock('../../../pages/AddGlossary/AddGlossaryPage.component', () => {
  return jest.fn(() => <div>AddGlossaryPage</div>);
});

jest.mock('../../Glossary/GlossaryVersion/GlossaryVersion.component', () => {
  return jest.fn(() => <div>GlossaryVersion</div>);
});

jest.mock('../../../pages/Glossary/GlossaryPage/GlossaryPage.component', () => {
  return jest.fn(() => <div>GlossaryPage</div>);
});

jest.mock('../../../utils/PermissionsUtils', () => {
  return {
    userPermissions: {
      hasViewPermissions: jest.fn(() => true),
    },
  };
});

jest.mock('../AdminProtectedRoute', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children }) => children),
}));

describe('GlossaryRouter', () => {
  it('should render AddGlossaryPage component for add glossary route', async () => {
    render(
      <MemoryRouter initialEntries={['/add']}>
        <GlossaryRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('AddGlossaryPage')).toBeInTheDocument();
  });

  it('should render GlossaryVersion component for glossary version route', async () => {
    render(
      <MemoryRouter initialEntries={['/glossaryID/versions/123']}>
        <GlossaryRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('GlossaryVersion')).toBeInTheDocument();
  });

  it('should render GlossaryPage component for glossary details route', async () => {
    render(
      <MemoryRouter
        initialEntries={['', '/testGlossary', '/testGlossary/action/import']}>
        <GlossaryRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('GlossaryPage')).toBeInTheDocument();
  });

  it('should render GlossaryPage component for glossary details with tab/subtab route', async () => {
    render(
      <MemoryRouter
        initialEntries={['/testGlossary/tab', '/testGlossary/subtab']}>
        <GlossaryRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('GlossaryPage')).toBeInTheDocument();
  });
});
