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
import React from 'react';
import SchemaEditor from './SchemaEditor';

const mockOnChange = jest.fn();
const mockOnCopyToClipBoard = jest.fn();

const mockEditor = {
  refresh: jest.fn(),
  scrollTo: jest.fn(),
  getWrapperElement: jest.fn().mockReturnValue({ remove: jest.fn() }),
};

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

jest.mock('react-codemirror2', () => ({
  ...jest.requireActual('react-codemirror2'),
  Controlled: jest
    .fn()
    .mockImplementation(({ value, onChange, editorDidMount }) => {
      React.useEffect(() => {
        editorDidMount?.(mockEditor);
      }, []);

      return (
        <div>
          <span>{value}</span>
          <input
            data-testid="code-mirror-editor-input"
            type="text"
            onChange={onChange}
          />
        </div>
      );
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

const makeRect = (
  x = 0,
  y = 0,
  width = 0,
  height = 0
): DOMRectReadOnly => ({
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
    // Set in beforeEach because jest.useRealTimers() restores the original
    // (undefined in JSDOM), clobbering a beforeAll assignment.
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

  it('Value provided via props should be visible', async () => {
    render(<SchemaEditor {...mockProps} />);

    expect(
      (await screen.findByTestId('code-mirror-container')).textContent
    ).toBe('test SQL query');
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

    fireEvent.change(screen.getByTestId('code-mirror-editor-input'), {
      target: { value: 'new SQL query' },
    });

    expect(mockOnChange).toHaveBeenCalled();
  });

  describe('refreshEditor prop', () => {
    it('Should call scrollTo and refresh when refreshEditor is true', () => {
      jest.useFakeTimers();
      render(<SchemaEditor {...mockProps} refreshEditor />);

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(mockEditor.scrollTo).toHaveBeenCalledWith(0, 0);
      expect(mockEditor.refresh).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('Should not call refresh if refreshEditor is false', () => {
      jest.useFakeTimers();
      render(<SchemaEditor {...mockProps} refreshEditor={false} />);

      act(() => {
        jest.advanceTimersByTime(50);
      });

      expect(mockEditor.refresh).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('Should call scrollTo(0,0) via requestAnimationFrame after refresh', () => {
      jest.useFakeTimers();
      render(<SchemaEditor {...mockProps} refreshEditor />);

      act(() => {
        jest.runAllTimers();
      });

      // scrollTo called twice: once before refresh, once in rAF after refresh
      expect(mockEditor.scrollTo).toHaveBeenCalledTimes(2);
      expect(mockEditor.scrollTo).toHaveBeenNthCalledWith(1, 0, 0);
      expect(mockEditor.scrollTo).toHaveBeenNthCalledWith(2, 0, 0);

      jest.useRealTimers();
    });
  });

  describe('IntersectionObserver visibility detection', () => {
    it('Should set up IntersectionObserver on mount', () => {
      render(<SchemaEditor {...mockProps} />);

      // intersectionCallback is populated by the constructor, confirming observer was created
      expect(intersectionCallback).toBeDefined();
      expect(mockObserve).toHaveBeenCalled();
    });

    it('Should call refresh and scrollTo when transitioning from hidden to visible', () => {
      render(<SchemaEditor {...mockProps} />);

      mockEditor.refresh.mockClear();
      mockEditor.scrollTo.mockClear();

      // Simulate element being hidden (display: none → height collapses to 0)
      act(() => {
        intersectionCallback([makeEntry(0)]);
      });

      expect(mockEditor.refresh).not.toHaveBeenCalled();

      // Simulate element becoming visible again (height > 0)
      act(() => {
        intersectionCallback([makeEntry(100)]);
      });

      expect(mockEditor.scrollTo).toHaveBeenCalledWith(0, 0);
      expect(mockEditor.refresh).toHaveBeenCalled();
    });

    it('Should not trigger refresh on first visible callback if not previously hidden', () => {
      render(<SchemaEditor {...mockProps} />);

      mockEditor.refresh.mockClear();
      mockEditor.scrollTo.mockClear();

      act(() => {
        intersectionCallback([makeEntry(100)]);
      });

      expect(mockEditor.refresh).not.toHaveBeenCalled();
      expect(mockEditor.scrollTo).not.toHaveBeenCalled();
    });

    it('Should not trigger refresh when scrolled out and back into viewport', () => {
      render(<SchemaEditor {...mockProps} />);

      mockEditor.refresh.mockClear();
      mockEditor.scrollTo.mockClear();

      // Height stays > 0 when scrolled out of viewport (not display:none)
      act(() => {
        intersectionCallback([makeEntry(200)]);
      });

      act(() => {
        intersectionCallback([makeEntry(200)]);
      });

      expect(mockEditor.refresh).not.toHaveBeenCalled();
      expect(mockEditor.scrollTo).not.toHaveBeenCalled();
    });

    it('Should disconnect observer on unmount', () => {
      const { unmount } = render(<SchemaEditor {...mockProps} />);

      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });
});
