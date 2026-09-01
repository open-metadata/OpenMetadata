/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { render, screen } from '@testing-library/react';
import { PropsWithChildren } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { contextCenterModule } from './contextCenter.module';

jest.mock(
  '../../ContextCenter/ContextCenterLayout/ContextCenterLayout',
  () => ({
    __esModule: true,
    default: ({ children }: PropsWithChildren) => (
      <div data-testid="context-center-layout">{children}</div>
    ),
  })
);

jest.mock('pages/KnowledgeCenterFilterPage/KnowledgeCenterFilterPage', () => ({
  __esModule: true,
  default: () => <div data-testid="knowledge-center-filter-page" />,
}));

const LocationProbe = () => {
  const { search } = useLocation();

  return <div data-testid="location-search">{search}</div>;
};

describe('contextCenterModule — knowledge page filter', () => {
  it('renders the classic filter page and preserves its query parameters', async () => {
    const route = contextCenterModule.routes.find(
      ({ path }) => path === ROUTES.CONTEXT_CENTER_FILTER
    );

    expect(route).toBeDefined();

    render(
      <MemoryRouter
        initialEntries={[
          '/context-center/filter?entityId=entity-123&entityType=table',
        ]}>
        <LocationProbe />
        <Routes>
          <Route element={route?.element} path={route?.path as string} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      await screen.findByTestId('knowledge-center-filter-page')
    ).toBeInTheDocument();
    expect(screen.getByTestId('context-center-layout')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent(
      '?entityId=entity-123&entityType=table'
    );
  });
});
