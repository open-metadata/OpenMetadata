/*
 *  Copyright 2023 Collate.
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
import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { useClipboard } from './useClipBoard';

const clipboardWriteTextMock = jest.fn();
const clipboardMock = {
  writeText: clipboardWriteTextMock,
};

Object.defineProperty(window.navigator, 'clipboard', {
  value: clipboardMock,
  writable: true,
});

// Mock document.execCommand for fallback testing
const execCommandMock = jest.fn();

// Mock window.isSecureContext
Object.defineProperty(window, 'isSecureContext', {
  value: true,
  writable: true,
});

// Mock document.execCommand
Object.defineProperty(document, 'execCommand', {
  value: execCommandMock,
  writable: true,
});

// Mock document.createElement and related DOM methods
const createElementMock = jest.fn();
const appendChildMock = jest.fn();
const removeChildMock = jest.fn();
const focusMock = jest.fn();
const selectMock = jest.fn();

const mockTextArea = {
  value: '',
  style: {},
  focus: focusMock,
  select: selectMock,
};

createElementMock.mockReturnValue(mockTextArea);

Object.defineProperty(document, 'createElement', {
  value: createElementMock,
  writable: true,
});

Object.defineProperty(document.body, 'appendChild', {
  value: appendChildMock,
  writable: true,
});

Object.defineProperty(document.body, 'removeChild', {
  value: removeChildMock,
  writable: true,
});

const value = 'Test Value';
const callBack = jest.fn();
const timeout = 1000;

describe('useClipboard hook', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Set up default clipboard mock
    Object.defineProperty(window.navigator, 'clipboard', {
      value: clipboardMock,
      writable: true,
    });

    // Set secure context to true by default
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Original tests
  it('Should copy to clipboard', async () => {
    clipboardWriteTextMock.mockResolvedValue(value);
    const { result } = renderHook(() => useClipboard(value, timeout, callBack));

    await act(async () => {
      result.current.onCopyToClipBoard();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(value);
    expect(result.current.hasCopied).toBe(true);
    expect(callBack).toHaveBeenCalled();
  });

  it('Should handle error while copying to clipboard', async () => {
    clipboardWriteTextMock.mockRejectedValue('Error');
    const { result } = renderHook(() => useClipboard(value));

    await act(async () => {
      result.current.onCopyToClipBoard();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(value);
    expect(result.current.hasCopied).toBe(false);
  });

  it('Should reset hasCopied after the timeout', async () => {
    clipboardWriteTextMock.mockResolvedValue(value);

    jest.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value, timeout, callBack }) => useClipboard(value, timeout, callBack),
      { initialProps: { value, timeout, callBack } }
    );

    await act(async () => {
      result.current.onCopyToClipBoard();
    });

    expect(result.current.hasCopied).toBe(true);

    jest.advanceTimersByTime(timeout);

    rerender({ value, timeout, callBack });

    expect(result.current.hasCopied).toBe(false);
  });

  // New comprehensive tests for fallback functionality
  it('Should copy to clipboard using modern API when available', async () => {
    clipboardWriteTextMock.mockResolvedValue(value);
    const { result } = renderHook(() => useClipboard(value, timeout, callBack));

    await act(async () => {
      result.current.onCopyToClipBoard();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(value);
    expect(result.current.hasCopied).toBe(true);
    expect(callBack).toHaveBeenCalled();
  });

  it('Should use fallback method when modern API is not available', async () => {
    // Remove clipboard API
    Object.defineProperty(window.navigator, 'clipboard', {
      value: undefined,
      writable: true,
    });

    execCommandMock.mockReturnValue(true);

    const { result } = renderHook(() => useClipboard(value, timeout, callBack));

    await act(async () => {
      result.current.onCopyToClipBoard();
    });

    expect(createElementMock).toHaveBeenCalledWith('textarea');
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(result.current.hasCopied).toBe(true);
    expect(callBack).toHaveBeenCalled();
  });

  it('Should use fallback method when not in secure context', async () => {
    // Set secure context to false
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      writable: true,
    });

    execCommandMock.mockReturnValue(true);

    const { result } = renderHook(() => useClipboard(value, timeout, callBack));

    await act(async () => {
      result.current.onCopyToClipBoard();
    });

    expect(createElementMock).toHaveBeenCalledWith('textarea');
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(result.current.hasCopied).toBe(true);
    expect(callBack).toHaveBeenCalled();
  });

  it('Should handle error when modern API fails and fallback succeeds', async () => {
    clipboardWriteTextMock.mockRejectedValue(new Error('Modern API failed'));
    execCommandMock.mockReturnValue(true);

    const { result } = renderHook(() => useClipboard(value, timeout, callBack));

    await act(async () => {
      result.current.onCopyToClipBoard();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(value);
    expect(createElementMock).toHaveBeenCalledWith('textarea');
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(result.current.hasCopied).toBe(true);
    expect(callBack).toHaveBeenCalled();
  });

  it('Should handle error when both modern API and fallback fail', async () => {
    clipboardWriteTextMock.mockRejectedValue(new Error('Modern API failed'));
    execCommandMock.mockReturnValue(false);

    const { result } = renderHook(() => useClipboard(value, timeout, callBack));

    await act(async () => {
      result.current.onCopyToClipBoard();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(value);
    expect(createElementMock).toHaveBeenCalledWith('textarea');
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(result.current.hasCopied).toBe(false);
    expect(callBack).not.toHaveBeenCalled();
  });

  it('Should handle error when fallback throws exception', async () => {
    // Remove clipboard API
    Object.defineProperty(window.navigator, 'clipboard', {
      value: undefined,
      writable: true,
    });

    execCommandMock.mockImplementation(() => {
      throw new Error('execCommand failed');
    });

    const { result } = renderHook(() => useClipboard(value, timeout, callBack));

    await act(async () => {
      result.current.onCopyToClipBoard();
    });

    expect(createElementMock).toHaveBeenCalledWith('textarea');
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(result.current.hasCopied).toBe(false);
    expect(callBack).not.toHaveBeenCalled();
  });

  it('Should handle paste from clipboard using modern API when available', async () => {
    const mockReadText = jest.fn().mockResolvedValue('Pasted text');
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { ...clipboardMock, readText: mockReadText },
      writable: true,
    });

    const { result } = renderHook(() => useClipboard(value, timeout, callBack));

    await act(async () => {
      const pastedText = await result.current.onPasteFromClipBoard();

      expect(pastedText).toBe('Pasted text');
    });

    expect(mockReadText).toHaveBeenCalled();
  });

  it('Should return null for paste when modern API is not available', async () => {
    // Remove clipboard API
    Object.defineProperty(window.navigator, 'clipboard', {
      value: undefined,
      writable: true,
    });

    const { result } = renderHook(() => useClipboard(value, timeout, callBack));

    await act(async () => {
      const pastedText = await result.current.onPasteFromClipBoard();

      expect(pastedText).toBeNull();
    });
  });

  it('Should return null for paste when not in secure context', async () => {
    // Set secure context to false
    Object.defineProperty(window, 'isSecureContext', {
      value: false,
      writable: true,
    });

    const { result } = renderHook(() => useClipboard(value, timeout, callBack));

    await act(async () => {
      const pastedText = await result.current.onPasteFromClipBoard();

      expect(pastedText).toBeNull();
    });
  });

  it('Should update value state when value prop changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useClipboard(value, timeout, callBack),
      { initialProps: { value: 'Initial Value' } }
    );

    expect(result.current.hasCopied).toBe(false);

    rerender({ value: 'Updated Value' });

    // Trigger copy to verify it uses the updated value
    act(() => {
      result.current.onCopyToClipBoard();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Updated Value');
  });
});
