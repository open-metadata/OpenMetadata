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

import { act, renderHook } from '@testing-library/react';
import { useConnectionsViewMode } from './useConnectionsViewMode';

const mockSetSearchParams = jest.fn();
let mockSearchParams = new URLSearchParams();
const mockSetPreference = jest.fn();
let mockConnectionsViewMode: string | undefined;

jest.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

jest.mock('../../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: () => ({
    preferences: { connectionsViewMode: mockConnectionsViewMode },
    setPreference: mockSetPreference,
  }),
}));

describe('useConnectionsViewMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockConnectionsViewMode = undefined;
  });

  it('defaults to grid view', () => {
    const { result } = renderHook(() => useConnectionsViewMode());

    expect(result.current.viewMode).toBe('grid');
  });

  it('reads a valid persisted view mode', () => {
    mockConnectionsViewMode = 'list';

    const { result } = renderHook(() => useConnectionsViewMode());

    expect(result.current.viewMode).toBe('list');
  });

  it('prefers a valid URL value over the persisted preference', () => {
    mockConnectionsViewMode = 'grid';
    mockSearchParams = new URLSearchParams('viewMode=list');

    const { result } = renderHook(() => useConnectionsViewMode());

    expect(result.current.viewMode).toBe('list');
  });

  it('falls through an invalid URL value to the persisted preference', () => {
    mockConnectionsViewMode = 'list';
    mockSearchParams = new URLSearchParams('viewMode=cards');

    const { result } = renderHook(() => useConnectionsViewMode());

    expect(result.current.viewMode).toBe('list');
  });

  it('sets the URL and persists a selected view mode', () => {
    const { result } = renderHook(() => useConnectionsViewMode());

    act(() => result.current.setViewMode('list'));

    expect(mockSetSearchParams).toHaveBeenCalledTimes(1);

    const [updater, options] = mockSetSearchParams.mock.calls[0];
    const next = updater(new URLSearchParams('category=all'));

    expect(next.get('viewMode')).toBe('list');
    expect(next.get('category')).toBe('all');
    expect(options).toEqual({ replace: true });
    expect(mockSetPreference).toHaveBeenCalledWith({
      connectionsViewMode: 'list',
    });
  });
});
