/*
 *  Copyright 2022 Collate.
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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { UseCodeMirrorOptions } from '../../../hooks/useCodeMirror';
import SchemaEditor from './SchemaEditor';

const mockOnChange = jest.fn();
const mockOnCopyToClipBoard = jest.fn();
const mockRequestRefresh = jest.fn();

let capturedOnChange: ((val: string) => void) | undefined;
let capturedOpts: Partial<UseCodeMirrorOptions> = {};

jest.mock('../../../constants/constants', () => ({
  JSON_TAB_SIZE: 25,
}));

jest.mock('../../../utils/SchemaEditor.utils', () => ({
  getSchemaEditorValue: jest.fn().mockReturnValue('test SQL query'),
}));

jest.mock('../../../hooks/useClipBoard', () => ({
  ...jest.requireActual('../../../hooks/useClipBoard'),
  useClipboard: jest
    .fn()
    .mockImplementation(() => ({ onCopyToClipBoard: mockOnCopyToClipBoard })),
}));

jest.mock('../../../hooks/useCodeMirror', () => ({
  useCodeMirror: jest.fn().mockImplementation((opts: UseCodeMirrorOptions) => {
    capturedOnChange = opts.onChange;
    capturedOpts = { ...opts };

    return {
      editorRef: jest.fn(),
      viewRef: {
        current: {
          scrollDOM: { scrollTo: jest.fn() },
          requestMeasure: jest.fn(),
          state: { doc: { toString: () => opts.value ?? '' } },
          dispatch: jest.fn(),
        },
      },
      requestRefresh: mockRequestRefresh,
    };
  }),
}));

let intersectionCallback: (entries: IntersectionObserverEntry[]) => void;
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = (entries) => callback(entries, this);
  }

  observe(target: Element): void {
    mockObserve(target);
  }

  unobserve(_target: Element): void {}

  disconnect(): void {
    mockDisconnect();
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const makeRect = (x = 0, y = 0, width = 0, height = 0): DOMRectReadOnly => ({
  x,
  y,
  width,
  height,
  top: y,
  left: x,
  right: x + width,
  bottom: y + height,
  toJSON: () => ({}),
});

const makeEntry = (height: number): IntersectionObserverEntry => ({
  boundingClientRect: makeRect(0, 0, 100, height),
  intersectionRatio: height > 0 ? 1 : 0,
  intersectionRect: makeRect(),
  isIntersecting: height > 0,
  rootBounds: null,
  target: document.createElement('div'),
  time: 0,
});

const mockProps = {
  value: 'test SQL query',
  showCopyButton: true,
  onChange: mockOnChange,
};

describe('SchemaEditor component test', () => {
  beforeAll(() => {
    window.IntersectionObserver = MockIntersectionObserver;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOpts = {};
    window.requestAnimationFrame = jest
      .fn()
      .mockImplementation((cb: FrameRequestCallback) => {
        cb(0);

        return 0;
      });
  });

  it('Component should render properly', async () => {
    render(<SchemaEditor {...mockProps} />);

    expect(
      await screen.findByTestId('code-mirror-container')
    ).toBeInTheDocument();

    expect(await screen.findByTestId('query-copy-button')).toBeInTheDocument();
  });

  it('Copy button should not be visible', async () => {
    render(<SchemaEditor {...mockProps} showCopyButton={false} />);

    expect(screen.queryByTestId('query-copy-button')).not.toBeInTheDocument();
  });

  it('Should call onCopyToClipBoard', async () => {
    render(<SchemaEditor {...mockProps} />);

    fireEvent.click(screen.getByTestId('query-copy-button'));

    expect(mockOnCopyToClipBoard).toHaveBeenCalled();
  });

  it('Should call onChange handler', async () => {
    render(<SchemaEditor {...mockProps} />);

    act(() => {
      capturedOnChange?.('new SQL query');
    });

    expect(mockOnChange).toHaveBeenCalled();
  });

  describe('refreshEditor prop', () => {
    it('Should call requestRefresh when refreshEditor is true', () => {
      jest.useFakeTimers();
      render(<SchemaEditor {...mockProps} refreshEditor />);

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(mockRequestRefresh).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('Should not call requestRefresh if refreshEditor is false', () => {
      jest.useFakeTimers();
      render(<SchemaEditor {...mockProps} refreshEditor={false} />);

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(mockRequestRefresh).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('IntersectionObserver visibility detection', () => {
    it('Should set up IntersectionObserver on mount', () => {
      render(<SchemaEditor {...mockProps} />);

      expect(intersectionCallback).toBeDefined();
      expect(mockObserve).toHaveBeenCalled();
    });

    it('Should call requestRefresh when transitioning from hidden to visible', () => {
      render(<SchemaEditor {...mockProps} />);

      mockRequestRefresh.mockClear();

      act(() => {
        intersectionCallback([makeEntry(0)]);
      });

      expect(mockRequestRefresh).not.toHaveBeenCalled();

      act(() => {
        intersectionCallback([makeEntry(100)]);
      });

      expect(mockRequestRefresh).toHaveBeenCalled();
    });

    it('Should not trigger requestRefresh on first visible callback if not previously hidden', () => {
      render(<SchemaEditor {...mockProps} />);

      mockRequestRefresh.mockClear();

      act(() => {
        intersectionCallback([makeEntry(100)]);
      });

      expect(mockRequestRefresh).not.toHaveBeenCalled();
    });

    it('Should not trigger requestRefresh when scrolled out and back into viewport', () => {
      render(<SchemaEditor {...mockProps} />);

      mockRequestRefresh.mockClear();

      act(() => {
        intersectionCallback([makeEntry(200)]);
      });

      act(() => {
        intersectionCallback([makeEntry(200)]);
      });

      expect(mockRequestRefresh).not.toHaveBeenCalled();
    });

    it('Should disconnect observer on unmount', () => {
      const { unmount } = render(<SchemaEditor {...mockProps} />);

      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('readOnly prop', () => {
    it('should use top-level readOnly when provided', () => {
      render(<SchemaEditor {...mockProps} readOnly />);

      expect(capturedOpts.readOnly).toBe(true);
    });

    it('should fall back to options.readOnly when top-level readOnly is not set', () => {
      render(<SchemaEditor {...mockProps} options={{ readOnly: true }} />);

      expect(capturedOpts.readOnly).toBe(true);
    });

    it('top-level readOnly takes precedence over options.readOnly', () => {
      render(
        <SchemaEditor
          {...mockProps}
          options={{ readOnly: true }}
          readOnly={false}
        />
      );

      expect(capturedOpts.readOnly).toBe(false);
    });
  });
});
