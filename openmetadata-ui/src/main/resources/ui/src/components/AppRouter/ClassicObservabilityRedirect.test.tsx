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
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ClassicObservabilityRedirect from './ClassicObservabilityRedirect';

const CurrentLocation = () => {
  const { pathname, search } = useLocation();

  return <span data-testid="location">{`${pathname}${search}`}</span>;
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          element={<ClassicObservabilityRedirect />}
          path="/observability/*"
        />
        <Route element={<CurrentLocation />} path="*" />
      </Routes>
    </MemoryRouter>
  );

describe('ClassicObservabilityRedirect', () => {
  it.each([
    ['/observability', '/data-quality'],
    ['/observability/', '/data-quality'],
    ['/observability/incident-manager', '/incident-manager'],
    [
      '/observability/data-quality/test-cases?status=Failed',
      '/data-quality/test-cases?status=Failed',
    ],
    ['/observability/test-case/a.b%2Fc/issues', '/test-case/a.b%2Fc/issues'],
  ])('redirects %s to the Classic route %s', (from, to) => {
    renderAt(from);

    expect(screen.getByTestId('location')).toHaveTextContent(to);
  });
});
