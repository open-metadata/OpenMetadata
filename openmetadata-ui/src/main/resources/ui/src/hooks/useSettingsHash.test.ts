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

  it('should parse #bots correctly', () => {
    window.location.hash = '#bots';
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBe('bots');
    expect(result.current.state.subPath).toBe('');
    expect(result.current.state.params).toEqual({});
  });

  it('should parse #bots/subpath correctly', () => {
    window.location.hash = '#bots/autoclassification-bot';
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBe('bots');
    expect(result.current.state.subPath).toBe('autoclassification-bot');
  });

  it('should parse hash with query params', () => {
    window.location.hash = '#bots?page=2&cursorType=after';
    const { result } = renderHook(() => useSettingsHash());

    expect(result.current.state.tab).toBe('bots');
    expect(result.current.state.params).toEqual({
      page: '2',
      cursorType: 'after',
    });
  });

  it('should set hash via setHash', () => {
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.setHash('bots', 'my-bot');
    });

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '#bots/my-bot');
  });

  it('should set hash with params', () => {
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.setHash('bots', undefined, { page: '2' });
    });

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '#bots?page=2');
  });

  it('should clear hash via clearHash', () => {
    window.location.hash = '#bots';
    const { result } = renderHook(() => useSettingsHash());

    act(() => {
      result.current.clearHash();
    });

    expect(replaceStateSpy).toHaveBeenCalled();
    const callArg = replaceStateSpy.mock.calls[0][2] as string;

    expect(callArg).not.toContain('#');
  });
});
