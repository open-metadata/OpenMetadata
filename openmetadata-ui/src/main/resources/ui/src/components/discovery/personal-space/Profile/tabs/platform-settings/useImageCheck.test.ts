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
import { useImageCheck } from './useImageCheck';

let loadsSucceed = true;
let corsLoadsHang = false;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';

  set src(_value: string) {
    // The contrast check is the only load that sets crossOrigin.
    if (this.crossOrigin && corsLoadsHang) {
      return;
    }
    setTimeout(() => (loadsSucceed ? this.onload?.() : this.onerror?.()));
  }
}

describe('useImageCheck', () => {
  const OriginalImage = global.Image;

  beforeEach(() => {
    jest.useFakeTimers();
    global.Image = FakeImage as unknown as typeof Image;
  });

  afterEach(() => {
    corsLoadsHang = false;
    jest.useRealTimers();
    global.Image = OriginalImage;
  });

  const settle = () =>
    act(async () => {
      await jest.runAllTimersAsync();
    });

  it('is idle for an empty URL and invalid for a malformed one', () => {
    const { result, rerender } = renderHook(useImageCheck, {
      initialProps: undefined as string | undefined,
    });

    expect(result.current.status).toBe('idle');

    rerender('cdn.example.com/logo');

    expect(result.current.status).toBe('invalid');
  });

  it('reports loading, then loaded for a reachable image', async () => {
    loadsSucceed = true;
    const { result } = renderHook(() =>
      useImageCheck('https://cdn.example.com/logo.svg')
    );

    expect(result.current.status).toBe('loading');

    await settle();

    expect(result.current.status).toBe('loaded');
  });

  it('reports an error when the URL does not load as an image', async () => {
    loadsSucceed = false;
    const { result } = renderHook(() =>
      useImageCheck('https://cdn.example.com/logo.pdf')
    );

    await settle();

    expect(result.current).toEqual({
      status: 'error',
      isHardToSeeOnDark: false,
    });
  });

  it('reports loaded without waiting for the optional contrast check', async () => {
    loadsSucceed = true;
    corsLoadsHang = true;
    const { result } = renderHook(() =>
      useImageCheck('https://cdn.example.com/logo.svg')
    );

    await settle();

    expect(result.current).toEqual({
      status: 'loaded',
      isHardToSeeOnDark: false,
    });
  });
});
