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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PropsWithChildren, ReactNode } from 'react';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { RouteVisibilityProvider } from '../../../context/RouteVisibilityProvider/RouteVisibilityProvider';
import DocumentTitle from './DocumentTitle';
import { DocumentTitlePriority } from './DocumentTitle.store';
import { DocumentTitleProvider } from './DocumentTitleProvider';

jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }: PropsWithChildren) => (
    <span data-testid="resolved-title">{children}</span>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key.replace('label.', ''),
  }),
}));

const renderAt = (initialPath: string, children: ReactNode) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <DocumentTitleProvider>
        <Routes>
          <Route element={children} path="/glossary/:fqn/:tab" />
          <Route element={children} path="/glossary/:fqn" />
          <Route element={children} path="*" />
        </Routes>
      </DocumentTitleProvider>
    </MemoryRouter>
  );

// Remounts on every navigation, like a shell that re-registers to get ahead of the page.
const RemountingShellTitle = () => {
  const { pathname } = useLocation();

  return (
    <DocumentTitle
      key={pathname}
      priority={DocumentTitlePriority.SHELL}
      title="Glossary"
    />
  );
};

const NavigateTo = ({ path }: { path: string }) => {
  const navigate = useNavigate();

  return <button onClick={() => navigate(path)}>{path}</button>;
};

const expectTitle = async (expected: string) =>
  waitFor(() =>
    expect(screen.getByTestId('resolved-title')).toHaveTextContent(expected)
  );

describe('DocumentTitle', () => {
  it('renders the brand alone while nothing claims a title', async () => {
    renderAt('/', null);

    await expectTitle('brand-name');
  });

  it('lets a page title beat a shell title rendered above it', async () => {
    renderAt(
      '/table/dim_customer',
      <>
        <DocumentTitle
          priority={DocumentTitlePriority.SHELL}
          title="Collate AI"
        />
        <DocumentTitle title="dim_customer" />
      </>
    );

    await expectTitle('dim_customer | brand-name');
  });

  it('lets a nested title beat its page layout title', async () => {
    renderAt(
      '/glossary/BankingCore',
      <>
        <DocumentTitle title="Glossary" />
        <div>
          <DocumentTitle title="Banking Core" />
        </div>
      </>
    );

    await expectTitle('Banking Core | brand-name');
  });

  it('appends the active tab from the route', async () => {
    renderAt(
      '/glossary/BankingCore/relations_graph',
      <DocumentTitle title="Banking Core" />
    );

    await expectTitle('Banking Core | relations-graph | brand-name');
  });

  it('ignores a path segment that is not a known tab', async () => {
    renderAt(
      '/glossary/BankingCore/not-a-tab',
      <DocumentTitle title="Banking Core" />
    );

    await expectTitle('Banking Core | brand-name');
  });

  it('ignores an inherited object key in the tab segment', async () => {
    renderAt(
      '/glossary/BankingCore/constructor',
      <DocumentTitle title="Banking Core" />
    );

    await expectTitle('Banking Core | brand-name');
  });

  it('keeps the page title when a sibling tab route updates it in place', async () => {
    renderAt(
      '/glossary/BankingCore',
      <>
        <RemountingShellTitle />
        <DocumentTitle title="Banking Core" />
        <NavigateTo path="/glossary/BankingCore/relations_graph" />
        <NavigateTo path="/glossary/BankingCore/terms" />
      </>
    );

    await expectTitle('Banking Core | brand-name');

    fireEvent.click(
      screen.getByRole('button', {
        name: '/glossary/BankingCore/relations_graph',
      })
    );

    await expectTitle('Banking Core | relations-graph | brand-name');

    fireEvent.click(
      screen.getByRole('button', { name: '/glossary/BankingCore/terms' })
    );

    await expectTitle('Banking Core | term-plural | brand-name');
  });

  it('ignores a claim from a hidden kept-alive route', async () => {
    renderAt(
      '/table/dim_customer',
      <>
        <RouteVisibilityProvider isVisible={false}>
          <DocumentTitle title="Explore" />
        </RouteVisibilityProvider>
        <DocumentTitle
          priority={DocumentTitlePriority.SHELL}
          title="Collate AI"
        />
      </>
    );

    await expectTitle('Collate AI | brand-name');
  });

  it('releases its claim on unmount', async () => {
    const { rerender } = renderAt(
      '/table/dim_customer',
      <>
        <DocumentTitle
          priority={DocumentTitlePriority.SHELL}
          title="Collate AI"
        />
        <DocumentTitle title="dim_customer" />
      </>
    );

    await expectTitle('dim_customer | brand-name');

    rerender(
      <MemoryRouter initialEntries={['/table/dim_customer']}>
        <DocumentTitleProvider>
          <DocumentTitle
            priority={DocumentTitlePriority.SHELL}
            title="Collate AI"
          />
        </DocumentTitleProvider>
      </MemoryRouter>
    );

    await expectTitle('Collate AI | brand-name');
  });
});
