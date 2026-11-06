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

import { hideChartTooltips } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, useNavigate } from 'react-router-dom';
import KeepAliveRoutes, {
  getActiveCacheableRoute,
  isCacheableRoutePath,
} from './KeepAliveRoutes';

jest.mock('@openmetadata/ui-core-components', () => ({
  hideChartTooltips: jest.fn(),
}));

describe('isCacheableRoutePath', () => {
  it('accepts a static concrete path', () => {
    expect(isCacheableRoutePath('/observability/alerts')).toBe(true);
  });

  it('rejects wildcard and dynamic-segment paths', () => {
    expect(isCacheableRoutePath('/*')).toBe(false);
    expect(isCacheableRoutePath('/observability/test-case/:fqn')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isCacheableRoutePath(undefined)).toBe(false);
  });

  it('rejects the AskCollate New-Chat landing so it remounts fresh each visit', () => {
    expect(isCacheableRoutePath('/conversations')).toBe(false);
  });
});

describe('getActiveCacheableRoute', () => {
  const dataQuality = {
    element: <div>data-quality</div>,
    path: '/observability/data-quality',
  };
  const alerts = { element: <div>alerts</div>, path: '/observability/alerts' };
  // A module index route that only redirects to its default child. This must
  // never be treated as cacheable — a kept-alive <Navigate> re-fires its
  // redirect on every render (react-router runs it in a dependency-less
  // effect), which would yank the URL back to the module default the moment the
  // user navigates to a sibling sub-route.
  const observabilityIndex = {
    element: <Navigate replace to="/observability/data-quality" />,
    path: '/observability',
  };

  const routes = [observabilityIndex, dataQuality, alerts];

  it('matches a concrete cacheable route', () => {
    expect(getActiveCacheableRoute('/observability/alerts', routes)).toBe(
      alerts
    );
  });

  it('never returns a redirect (<Navigate>) route as cacheable', () => {
    // The bare prefix matches only the redirect route, which is excluded — so
    // there is no cacheable route and it falls through to the fallback <Routes>
    // where the redirect fires exactly once.
    expect(getActiveCacheableRoute('/observability', routes)).toBeUndefined();
  });
});

describe('KeepAliveRoutes', () => {
  const GoTo = ({ to }: { to: string }) => {
    const navigate = useNavigate();

    return (
      <button type="button" onClick={() => navigate(to)}>
        {to}
      </button>
    );
  };

  it('hides open chart tooltips when the active route changes', () => {
    render(
      <MemoryRouter initialEntries={['/first']}>
        <KeepAliveRoutes
          routes={[
            { element: <GoTo to="/second" />, path: '/first' },
            { element: <div>second</div>, path: '/second' },
          ]}
        />
      </MemoryRouter>
    );
    (hideChartTooltips as jest.Mock).mockClear();

    fireEvent.click(screen.getByText('/second'));

    expect(hideChartTooltips).toHaveBeenCalledTimes(1);
  });
});
