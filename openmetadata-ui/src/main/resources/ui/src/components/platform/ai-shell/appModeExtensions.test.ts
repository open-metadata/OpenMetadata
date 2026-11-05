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
import { renderHook } from '@testing-library/react';
import { EXTENSION_POINTS } from '../../../utils/ExtensionPointTypes';
import {
  useAppModeBanners,
  useAppModeOverlays,
  useAppModeRoutesFallback,
  useAppModeSidebarHeader,
  useAppModeSidebarMainFooter,
  useAppModeSidebarRailFooter,
  useAppModeSidebarRecent,
  useAppModeSidebarRecentRail,
} from './appModeExtensions';

const mockGetContributions = jest.fn();

jest.mock(
  '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({
      extensionRegistry: { getContributions: mockGetContributions },
    }),
  })
);

const Slot = () => null;
const slots = [{ key: 'a', component: Slot }];

describe('appModeExtensions', () => {
  it('returns the last routes fallback contribution', () => {
    const first = { element: 'first' };
    const last = { element: 'last' };
    mockGetContributions.mockReturnValue([first, last]);

    const { result } = renderHook(() => useAppModeRoutesFallback());

    expect(mockGetContributions).toHaveBeenCalledWith(
      EXTENSION_POINTS.APP_MODE_ROUTES_FALLBACK
    );
    expect(result.current).toBe(last);
  });

  it('returns undefined when no fallback is contributed', () => {
    mockGetContributions.mockReturnValue([]);

    const { result } = renderHook(() => useAppModeRoutesFallback());

    expect(result.current).toBeUndefined();
  });

  it.each([
    [useAppModeBanners, EXTENSION_POINTS.APP_MODE_LAYOUT_BANNERS],
    [useAppModeOverlays, EXTENSION_POINTS.APP_MODE_LAYOUT_OVERLAYS],
    [useAppModeSidebarHeader, EXTENSION_POINTS.APP_MODE_SIDEBAR_HEADER],
    [
      useAppModeSidebarMainFooter,
      EXTENSION_POINTS.APP_MODE_SIDEBAR_MAIN_FOOTER,
    ],
    [
      useAppModeSidebarRailFooter,
      EXTENSION_POINTS.APP_MODE_SIDEBAR_RAIL_FOOTER,
    ],
    [useAppModeSidebarRecent, EXTENSION_POINTS.APP_MODE_SIDEBAR_RECENT],
    [
      useAppModeSidebarRecentRail,
      EXTENSION_POINTS.APP_MODE_SIDEBAR_RECENT_RAIL,
    ],
  ])('%p reads slot contributions from %s', (hook, point) => {
    mockGetContributions.mockReturnValue(slots);

    const { result } = renderHook(() => hook());

    expect(mockGetContributions).toHaveBeenCalledWith(point);
    expect(result.current).toBe(slots);
  });
});
