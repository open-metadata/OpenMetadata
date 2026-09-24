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
import { useSettingsHash } from './useSettingsHash';

describe('useSettingsHash', () => {
  let replaceStateSpy: jest.SpyInstance;
  let dispatchEventSpy: jest.SpyInstance;

  beforeEach(() => {
    window.location.hash = '';
    replaceStateSpy = jest.spyOn(window.history, 'replaceState');
    dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
  });

  afterEach(() => {
    replaceStateSpy.mockRestore();
    dispatchEventSpy.mockRestore();
    window.location.hash = '';
  });

  it('should return null tab when no hash', () => {
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBeNull();
    expect(result.current.state.subPath).toBe('');
    expect(result.current.state.params).toEqual({});
  });

  it('should parse #notification correctly', () => {
    window.location.hash = '#notification';
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.subPath).toBe('');
    expect(result.current.state.params).toEqual({});
  });

  it('should parse #notification/subpath correctly', () => {
    window.location.hash = '#notification/alerts';
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.subPath).toBe('alerts');
  });

  it('should parse hash with query params', () => {
    window.location.hash = '#notification?page=2&cursorType=after';
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBe('notification');
    expect(result.current.state.params).toEqual({
      page: '2',
      cursorType: 'after',
    });
  });

  it('should set hash via setHash', () => {
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.setHash('notification', 'my-alert');
    });

    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      '',
      '#notification/my-alert'
    );
  });

  it('should set hash with params', () => {
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.setHash('notification', undefined, { page: '2' });
    });

    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      '',
      '#notification?page=2'
    );
  });

  it('should clear hash via clearHash', () => {
    window.location.hash = '#notification';
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.clearHash();
    });

    expect(replaceStateSpy).toHaveBeenCalled();

    const callArg = replaceStateSpy.mock.calls[0][2] as string;

    expect(callArg).not.toContain('#');
  });
});
