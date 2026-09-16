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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, ReactNode, useImperativeHandle } from 'react';
import LogViewerModal from './LogViewerModal.component';

// Captures the props LazyLog was last rendered with so tests can drive its
// scroll callback and assert on the imperative jump-to-end handle.
const mockLazyLog: {
  onScroll?: (v: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
  }) => void;
  scrollToIndex: jest.Mock;
} = {
  onScroll: undefined,
  scrollToIndex: jest.fn(),
};

const onCopyToClipBoard = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@melloware/react-logviewer', () => ({
  LazyLog: forwardRef(
    (
      {
        text,
        follow,
        formatPart,
        onScroll,
      }: {
        text: string;
        follow?: boolean;
        formatPart?: (text: string) => ReactNode;
        onScroll?: (v: {
          scrollTop: number;
          scrollHeight: number;
          clientHeight: number;
        }) => void;
      },
      ref
    ) => {
      mockLazyLog.onScroll = onScroll;
      useImperativeHandle(ref, () => ({
        state: { count: 3 },
        listRef: { current: { scrollToIndex: mockLazyLog.scrollToIndex } },
      }));

      return (
        // `overflowY` stands in for the real viewer's scroll container, which is
        // how the modal locates the element that needs a tab stop.
        <pre
          data-colorized={String(Boolean(formatPart))}
          data-follow={String(follow)}
          data-testid="lazy-log"
          style={{ overflowY: 'auto' }}>
          {text}
        </pre>
      );
    }
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({
    children,
    onPress,
    className,
    'data-testid': testId,
    'aria-label': ariaLabel,
    'aria-pressed': ariaPressed,
    onClick,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    className?: string;
    'data-testid'?: string;
    'aria-label'?: string;
    'aria-pressed'?: boolean;
    onClick?: () => void;
  }) => (
    <button
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className={className}
      data-testid={testId}
      onClick={onClick ?? onPress}>
      {children}
    </button>
  ),
  ModalOverlay: ({
    children,
    isOpen,
  }: {
    children: ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <div data-testid="modal-overlay">{children}</div> : null),
  Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CloseButton: ({
    onPress,
    theme,
    'data-testid': testId,
  }: {
    onPress?: () => void;
    theme?: string;
    'data-testid'?: string;
  }) => (
    <button data-testid={testId} data-theme={theme} onClick={onPress}>
      close
    </button>
  ),
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    children,
    onPress,
    className,
    'data-testid': testId,
    'aria-label': ariaLabel,
    'aria-pressed': ariaPressed,
  }: {
    children: ReactNode;
    onPress?: () => void;
    className?: string;
    'data-testid'?: string;
    'aria-label'?: string;
    'aria-pressed'?: boolean;
  }) => (
    <button
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className={className}
      data-testid={testId}
      onClick={onPress}>
      {children}
    </button>
  ),
}));

jest.mock('react-aria-components', () => ({
  Dialog: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="dialog">
      {children}
    </div>
  ),
}));

jest.mock('@untitledui/icons', () => ({
  AlignLeft: () => <span data-testid="icon-wrap" />,
  ArrowDown: () => <span data-testid="icon-follow" />,
  ChevronDownDouble: () => <span data-testid="icon-jump-to-end" />,
  Copy01: () => <span data-testid="icon-copy" />,
  Download01: () => <span data-testid="icon-download" />,
  File02: () => <span data-testid="icon-file" />,
  Maximize01: () => <span data-testid="icon-maximize" />,
  Minimize01: () => <span data-testid="icon-minimize" />,
  SearchMd: () => <span data-testid="icon-search" />,
}));

jest.mock('../../../hooks/useClipBoard', () => ({
  useClipboard: () => ({ hasCopied: false, onCopyToClipBoard }),
}));

jest.mock('../Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader">loading</div>,
}));

const defaultProps = {
  logs: 'alpha INFO one\nbravo WARN two\ncharlie INFO three',
  onClose: jest.fn(),
  open: true,
  title: 'Auto-document warehouse · logs',
};

describe('LogViewerModal', () => {
  beforeEach(() => {
    onCopyToClipBoard.mockClear();
    mockLazyLog.scrollToIndex.mockClear();
    mockLazyLog.onScroll = undefined;
  });

  it('renders the title and logs when open', () => {
    render(<LogViewerModal {...defaultProps} />);

    expect(screen.getByTestId('log-viewer-title')).toHaveTextContent(
      'Auto-document warehouse · logs'
    );
    expect(screen.getByTestId('lazy-log')).toHaveTextContent('alpha INFO one');
  });

  it('renders nothing when closed', () => {
    render(<LogViewerModal {...defaultProps} open={false} />);

    expect(screen.queryByTestId('lazy-log')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    render(<LogViewerModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('log-viewer-close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows the copy button by default, hides it when enableCopy is false, and copies on click', () => {
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('log-viewer-copy'));

    expect(onCopyToClipBoard).toHaveBeenCalledWith(defaultProps.logs);

    rerender(<LogViewerModal {...defaultProps} enableCopy={false} />);

    expect(screen.queryByTestId('log-viewer-copy')).not.toBeInTheDocument();
  });

  it('renders the download button only when onDownload is provided and fires it', () => {
    const onDownload = jest.fn();
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(screen.queryByTestId('log-viewer-download')).not.toBeInTheDocument();

    rerender(<LogViewerModal {...defaultProps} onDownload={onDownload} />);
    fireEvent.click(screen.getByTestId('log-viewer-download'));

    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('toggles the wrap button pressed state on click', () => {
    render(<LogViewerModal {...defaultProps} />);
    const wrapButton = screen.getByTestId('log-viewer-wrap');

    expect(wrapButton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(wrapButton);

    expect(wrapButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles fullscreen: flips aria-pressed, swaps the icon, and adds the fullscreen class', () => {
    render(<LogViewerModal {...defaultProps} />);
    const fullScreenButton = screen.getByTestId('log-viewer-fullscreen');

    expect(fullScreenButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('icon-maximize')).toBeInTheDocument();
    expect(screen.getByTestId('dialog')).not.toHaveClass('lvm-fullscreen');

    fireEvent.click(fullScreenButton);

    expect(fullScreenButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('icon-minimize')).toBeInTheDocument();
    expect(screen.getByTestId('dialog')).toHaveClass('lvm-fullscreen');
  });

  it('resets fullscreen when the modal is closed and reopened', () => {
    const { rerender } = render(<LogViewerModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('log-viewer-fullscreen'));

    expect(screen.getByTestId('dialog')).toHaveClass('lvm-fullscreen');

    rerender(<LogViewerModal {...defaultProps} open={false} />);
    rerender(<LogViewerModal {...defaultProps} open />);

    expect(screen.getByTestId('dialog')).not.toHaveClass('lvm-fullscreen');
  });

  it('scrolls to the last line when jump-to-end is clicked', () => {
    render(<LogViewerModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('log-viewer-jump-to-end'));

    expect(mockLazyLog.scrollToIndex).toHaveBeenCalledWith(2);
  });

  it('calls onLoadMore when scrolled to the bottom with more pages available', () => {
    const onLoadMore = jest.fn();
    render(
      <LogViewerModal {...defaultProps} hasMore onLoadMore={onLoadMore} />
    );

    mockLazyLog.onScroll?.({
      scrollTop: 100,
      scrollHeight: 100,
      clientHeight: 0,
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not call onLoadMore when hasMore is false or a fetch is already running', () => {
    const onLoadMore = jest.fn();
    const bottom = { scrollTop: 100, scrollHeight: 100, clientHeight: 0 };

    const { rerender } = render(
      <LogViewerModal
        {...defaultProps}
        hasMore={false}
        onLoadMore={onLoadMore}
      />
    );
    mockLazyLog.onScroll?.(bottom);

    rerender(
      <LogViewerModal
        {...defaultProps}
        hasMore
        loadingMore
        onLoadMore={onLoadMore}
      />
    );
    mockLazyLog.onScroll?.(bottom);

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('suppresses load-more while a search query is active', () => {
    const onLoadMore = jest.fn();
    render(
      <LogViewerModal {...defaultProps} hasMore onLoadMore={onLoadMore} />
    );

    fireEvent.change(screen.getByTestId('log-viewer-search'), {
      target: { value: 'INFO' },
    });
    mockLazyLog.onScroll?.({
      scrollTop: 100,
      scrollHeight: 100,
      clientHeight: 0,
    });

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('shows a loader in place of the download button while downloading', () => {
    const onDownload = jest.fn();
    render(
      <LogViewerModal {...defaultProps} downloading onDownload={onDownload} />
    );

    expect(
      screen.getByTestId('log-viewer-download-loader')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('log-viewer-download')).not.toBeInTheDocument();
  });

  it('shows the loader instead of logs when loading', () => {
    render(<LogViewerModal {...defaultProps} loading />);

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByTestId('lazy-log')).not.toBeInTheDocument();
  });

  it('applies the dark theme class by default and the light theme class when requested', () => {
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(screen.getByTestId('dialog')).toHaveClass('dark-mode');

    rerender(<LogViewerModal {...defaultProps} theme="light" />);

    expect(screen.getByTestId('dialog')).toHaveClass('theme-light');
    expect(screen.getByTestId('dialog')).not.toHaveClass('dark-mode');
  });

  it('passes the follow flag through to the log viewer', () => {
    render(<LogViewerModal {...defaultProps} follow />);

    expect(screen.getByTestId('lazy-log')).toHaveAttribute(
      'data-follow',
      'true'
    );
  });

  it('colourises the logs by default and not when colorize is false', () => {
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(screen.getByTestId('lazy-log')).toHaveAttribute(
      'data-colorized',
      'true'
    );

    rerender(<LogViewerModal {...defaultProps} colorize={false} />);

    expect(screen.getByTestId('lazy-log')).toHaveAttribute(
      'data-colorized',
      'false'
    );
  });

  it('uses the dark close-button theme by default and light when theme is light', () => {
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(screen.getByTestId('log-viewer-close')).toHaveAttribute(
      'data-theme',
      'dark'
    );

    rerender(<LogViewerModal {...defaultProps} theme="light" />);

    expect(screen.getByTestId('log-viewer-close')).toHaveAttribute(
      'data-theme',
      'light'
    );
  });

  it('shows the header search by default and hides it when enableSearch is false', () => {
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(screen.getByTestId('log-viewer-search')).toBeInTheDocument();

    rerender(<LogViewerModal {...defaultProps} enableSearch={false} />);

    expect(screen.queryByTestId('log-viewer-search')).not.toBeInTheDocument();
  });

  it('filters the log lines and reports a match count as the user searches', () => {
    render(<LogViewerModal {...defaultProps} />);

    fireEvent.change(screen.getByTestId('log-viewer-search'), {
      target: { value: 'WARN' },
    });

    const log = screen.getByTestId('lazy-log');

    expect(log).toHaveTextContent('bravo WARN two');
    expect(log).not.toHaveTextContent('alpha INFO one');
    expect(screen.getByTestId('log-viewer-match-count')).toHaveTextContent('1');
  });

  it('shows the empty state when the search matches no lines', () => {
    render(<LogViewerModal {...defaultProps} />);

    fireEvent.change(screen.getByTestId('log-viewer-search'), {
      target: { value: 'no-such-line' },
    });

    expect(screen.getByTestId('log-viewer-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('lazy-log')).not.toBeInTheDocument();
    expect(screen.getByTestId('log-viewer-match-count')).toHaveTextContent('0');
  });

  it('renders the footer from explicit status, line count, run id, and last run props', () => {
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(screen.queryByTestId('log-viewer-footer')).not.toBeInTheDocument();

    rerender(
      <LogViewerModal
        {...defaultProps}
        lastRun="2026-06-22 10:10 UTC"
        runId="run_7f63999d"
        status={{ label: 'Succeeded', tone: 'success' }}
        totalLines={8}
      />
    );

    expect(screen.getByTestId('log-viewer-status')).toHaveTextContent(
      'Succeeded'
    );
    expect(screen.getByTestId('log-viewer-status')).toHaveClass(
      'lvm-status--success'
    );
    expect(screen.getByTestId('log-viewer-total-lines')).toHaveTextContent('8');
    expect(screen.getByTestId('log-viewer-run-id')).toHaveTextContent(
      'run_7f63999d'
    );
    expect(screen.getByTestId('log-viewer-last-run')).toHaveTextContent(
      '2026-06-22 10:10 UTC'
    );
  });
});

describe('LogViewerModal — live (stream) mode', () => {
  it('shows the live indicator and forces follow when mode is stream', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    expect(screen.getByTestId('log-viewer-live-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('lazy-log')).toHaveAttribute(
      'data-follow',
      'true'
    );
  });

  it('hides the live indicator and respects the follow prop when static', () => {
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(
      screen.queryByTestId('log-viewer-live-indicator')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('lazy-log')).toHaveAttribute(
      'data-follow',
      'false'
    );

    rerender(<LogViewerModal {...defaultProps} follow />);

    expect(screen.getByTestId('lazy-log')).toHaveAttribute(
      'data-follow',
      'true'
    );
  });

  it('swaps the live dot for a reconnecting one while the tail is between attempts', () => {
    render(
      <LogViewerModal
        {...defaultProps}
        mode="stream"
        streamHealth="connecting"
      />
    );

    expect(
      screen.getByTestId('log-viewer-reconnecting-indicator')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('log-viewer-live-indicator')
    ).not.toBeInTheDocument();
  });

  it('keeps the live dot once the tail is connected', () => {
    render(
      <LogViewerModal {...defaultProps} mode="stream" streamHealth="live" />
    );

    expect(screen.getByTestId('log-viewer-live-indicator')).toBeInTheDocument();
    expect(
      screen.queryByTestId('log-viewer-reconnecting-indicator')
    ).not.toBeInTheDocument();
  });

  it('does not show a reconnecting dot for a static run', () => {
    render(<LogViewerModal {...defaultProps} streamHealth="connecting" />);

    expect(
      screen.queryByTestId('log-viewer-reconnecting-indicator')
    ).not.toBeInTheDocument();
  });

  it('warns that earlier history was not replayed when the stream truncated', () => {
    render(<LogViewerModal {...defaultProps} streamTruncated mode="stream" />);

    expect(screen.getByTestId('log-viewer-truncated-notice')).toHaveTextContent(
      'message.log-stream-truncated'
    );
  });

  it('surfaces the server message when the stream fails', () => {
    render(
      <LogViewerModal
        {...defaultProps}
        mode="stream"
        streamError="No log backend is configured on this deployment."
      />
    );

    expect(screen.getByTestId('log-viewer-stream-error')).toHaveTextContent(
      'No log backend is configured on this deployment.'
    );
  });

  it('renders no notices by default', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    expect(
      screen.queryByTestId('log-viewer-truncated-notice')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('log-viewer-stream-error')
    ).not.toBeInTheDocument();
  });
});

describe('LogViewerModal — auto-follow', () => {
  // Geometry as the viewer reports it: tall content parked at the top vs. at the tail.
  const scrolledUp = { scrollTop: 0, scrollHeight: 1000, clientHeight: 400 };
  const atTail = { scrollTop: 600, scrollHeight: 1000, clientHeight: 400 };
  // What a relayout or an append looks like: the offset stands still while the
  // content grows, so the tail moves away from the view on its own.
  const tailMovedAway = {
    scrollTop: 600,
    scrollHeight: 2000,
    clientHeight: 400,
  };
  // At the tail again, but at a different offset — an unchanged offset is not the
  // user moving anywhere, so it would not exercise the resume path at all.
  const scrolledBackToTail = {
    scrollTop: 700,
    scrollHeight: 1100,
    clientHeight: 400,
  };

  beforeEach(() => {
    mockLazyLog.scrollToIndex.mockClear();
    mockLazyLog.onScroll = undefined;
  });

  it('renders the toggle pressed for a live run and not at all for a static one', () => {
    const { rerender } = render(
      <LogViewerModal {...defaultProps} mode="stream" />
    );

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    rerender(<LogViewerModal {...defaultProps} />);

    expect(screen.queryByTestId('log-viewer-follow')).not.toBeInTheDocument();
  });

  it('pauses following on a wheel-up over the log body, before any scroll is reported', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: -120 });

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('keeps following on a wheel-down, which is the tail direction', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: 120 });

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('pauses following on the keys that move back through the log', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);
    const body = screen.getByTestId('log-viewer-body');

    fireEvent.keyDown(body, { key: 'End' });

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    fireEvent.keyDown(body, { key: 'PageUp' });

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('keeps following and catches up when the tail moves away on its own', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(atTail));
    mockLazyLog.scrollToIndex.mockClear();

    // Toggling wrap re-measures every row, so the content grows under a standing
    // offset. Reading that as the user taking over is the bug this covers.
    fireEvent.click(screen.getByTestId('log-viewer-wrap'));
    act(() => mockLazyLog.onScroll?.(tailMovedAway));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(mockLazyLog.scrollToIndex).toHaveBeenCalledWith(2);
  });

  it('does not chase the tail for a user who has already paused', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(scrolledUp));
    mockLazyLog.scrollToIndex.mockClear();

    fireEvent.click(screen.getByTestId('log-viewer-wrap'));
    act(() =>
      mockLazyLog.onScroll?.({
        ...tailMovedAway,
        scrollTop: scrolledUp.scrollTop,
      })
    );

    expect(mockLazyLog.scrollToIndex).not.toHaveBeenCalled();
    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('takes the log back from a drag that reports no pointer event at all', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(atTail));

    fireEvent.click(screen.getByTestId('log-viewer-wrap'));

    // No wheel, no key, no pointerdown — a native scrollbar drag in a browser
    // that does not dispatch one. Pulling away from the tail twice in a row is
    // something the catch-up never does, so it has to hand control over.
    act(() => mockLazyLog.onScroll?.({ ...atTail, scrollTop: 400 }));
    act(() => mockLazyLog.onScroll?.({ ...atTail, scrollTop: 200 }));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('keeps following through a relayout that reports a run of offset corrections', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(atTail));

    fireEvent.click(screen.getByTestId('log-viewer-wrap'));

    // Re-measuring rows walks the offset down over many events as the content
    // shrinks back — 12 in a row on one measured wrap toggle. Each one tracks the
    // tail, so none of them is the user pulling away from it.
    for (let offset = 600; offset > 400; offset -= 40) {
      act(() =>
        mockLazyLog.onScroll?.({
          scrollTop: offset,
          scrollHeight: offset + 400,
          clientHeight: 400,
        })
      );
    }

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('keeps following through a click in the log during a relayout', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(atTail));

    // Clicking a log line is not scrolling. It must not hand control over, or an
    // intermediate report from the relayout that follows would read as the user
    // having scrolled away.
    fireEvent.click(screen.getByTestId('log-viewer-wrap'));
    fireEvent.pointerDown(screen.getByTestId('log-viewer-body'));
    mockLazyLog.scrollToIndex.mockClear();
    act(() => mockLazyLog.onScroll?.({ ...tailMovedAway, scrollTop: 120 }));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(mockLazyLog.scrollToIndex).toHaveBeenCalledWith(2);
  });

  it('lets a gesture win over the catch-up instead of being fought by it', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);
    const body = screen.getByTestId('log-viewer-body');

    act(() => mockLazyLog.onScroll?.(atTail));
    mockLazyLog.scrollToIndex.mockClear();

    fireEvent.wheel(body, { deltaY: -120 });
    act(() => mockLazyLog.onScroll?.(scrolledUp));

    expect(mockLazyLog.scrollToIndex).not.toHaveBeenCalled();
    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('gives the scrolling element a tab stop and a name so the scroll keys reach it', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    // jsdom reports the mocked viewer's own node as the scrollable one; what
    // matters is that whatever scrolls becomes focusable and named.
    const scroller = screen.getByTestId('lazy-log');

    expect(scroller).toHaveAttribute('tabindex', '0');
    expect(scroller).toHaveAttribute('role', 'region');
    expect(scroller).toHaveAttribute('aria-label', 'label.log-plural');

    scroller.focus();

    expect(scroller).toHaveFocus();

    fireEvent.keyDown(scroller, { key: 'PageUp' });

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('resumes when the user scrolls back down to the tail', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(atTail));
    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: -120 });

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    // Scrolling back down is a run of off-tail reports before the one that
    // actually reaches the tail. None of them may cancel the resume at the end.
    for (const scrollTop of [200, 300, 400, 500]) {
      fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: 120 });
      act(() =>
        mockLazyLog.onScroll?.({
          scrollTop,
          scrollHeight: 1000,
          clientHeight: 400,
        })
      );
    }

    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: 120 });
    act(() => mockLazyLog.onScroll?.(atTail));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('keeps following after a hand-made resume when an append lands short of the tail', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(atTail));
    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: -120 });
    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: 120 });
    act(() => mockLazyLog.onScroll?.(scrolledBackToTail));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    // The library scrolls itself on every append and lands approximately: the
    // offset moved a long way *towards* the tail and still stopped short of it.
    // Nobody scrolls down in order to leave the tail, so this cannot be the user.
    act(() =>
      mockLazyLog.onScroll?.({
        scrollTop: 800,
        scrollHeight: 1500,
        clientHeight: 400,
      })
    );

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('grants a hand-made resume the same catch-up grace as the toggle', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(atTail));
    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: -120 });
    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: 120 });
    act(() => mockLazyLog.onScroll?.(scrolledBackToTail));
    mockLazyLog.scrollToIndex.mockClear();

    // One gestureless report pulling away from the tail is what a relayout does
    // on its way to re-pinning it, so it is caught up rather than obeyed — the
    // same answer the toolbar toggle's resume gets.
    act(() =>
      mockLazyLog.onScroll?.({
        scrollTop: 500,
        scrollHeight: 1100,
        clientHeight: 400,
      })
    );

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(mockLazyLog.scrollToIndex).toHaveBeenCalledWith(2);
  });

  it('still lets a gestureless drag take back a hand-made resume', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(atTail));
    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: -120 });
    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: 120 });
    act(() => mockLazyLog.onScroll?.(scrolledBackToTail));

    // A native scrollbar drag reports no wheel and no key. Pulling away from the
    // tail twice in a row is something the catch-up never does, so the grace the
    // resume granted has to be outrun rather than being indefinite.
    for (const scrollTop of [500, 300]) {
      act(() =>
        mockLazyLog.onScroll?.({
          scrollTop,
          scrollHeight: 1100,
          clientHeight: 400,
        })
      );
    }

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('keeps following when its own catch-up reports an offset short of the tail', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(atTail));

    // An append moves the tail away, the viewer catches up, and the jump reports
    // an intermediate offset on the way. That is the viewer moving the view, not
    // the user leaving it.
    act(() => mockLazyLog.onScroll?.(tailMovedAway));
    act(() =>
      mockLazyLog.onScroll?.({
        scrollTop: 1200,
        scrollHeight: 2000,
        clientHeight: 400,
      })
    );

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('does not treat an earlier resume as consent after the user pauses again', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);
    const body = screen.getByTestId('log-viewer-body');

    act(() => mockLazyLog.onScroll?.(atTail));

    // Resume by hand, then take control straight back. The pause has to withdraw
    // the request to be at the tail, or the viewer's own snap-back moments later
    // reads as still wanting to follow.
    fireEvent.click(screen.getByTestId('log-viewer-follow'));
    fireEvent.click(screen.getByTestId('log-viewer-follow'));
    fireEvent.wheel(body, { deltaY: -120 });
    act(() => mockLazyLog.onScroll?.(scrolledBackToTail));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('does not resume when the viewer snaps back to the tail on an append', () => {
    const { rerender } = render(
      <LogViewerModal {...defaultProps} mode="stream" />
    );

    act(() => mockLazyLog.onScroll?.(atTail));
    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: -120 });

    // The library restores its own recorded offset when the text changes, which
    // can land back at the tail without the user having scrolled there.
    rerender(
      <LogViewerModal
        {...defaultProps}
        logs={`${defaultProps.logs}\ndelta INFO four`}
        mode="stream"
      />
    );
    act(() => mockLazyLog.onScroll?.(scrolledBackToTail));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('resumes only when the user asked to be at the tail, not when the viewer lands there', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(atTail));
    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: -120 });

    // The library restores its own offset on a text change and can land at the
    // tail on its own. With no gesture behind it, that is not a request to follow.
    act(() => mockLazyLog.onScroll?.(scrolledBackToTail));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    // The same landing, this time with the user having asked for it.
    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: 120 });
    act(() => mockLazyLog.onScroll?.(atTail));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('pauses following when the user scrolls away from the tail and resumes at the tail', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(scrolledUp));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByTestId('lazy-log')).toHaveAttribute(
      'data-follow',
      'false'
    );

    fireEvent.wheel(screen.getByTestId('log-viewer-body'), { deltaY: 120 });
    act(() => mockLazyLog.onScroll?.(atTail));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('lazy-log')).toHaveAttribute(
      'data-follow',
      'true'
    );
  });

  it('keeps following while the content does not fill the viewport', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() =>
      mockLazyLog.onScroll?.({
        scrollTop: 0,
        scrollHeight: 100,
        clientHeight: 400,
      })
    );

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('leaves the static follow prop untouched when the user scrolls', () => {
    render(<LogViewerModal {...defaultProps} follow />);

    act(() => mockLazyLog.onScroll?.(scrolledUp));

    expect(screen.getByTestId('lazy-log')).toHaveAttribute(
      'data-follow',
      'true'
    );
  });

  it('stops following when toggled off and jumps back to the tail when toggled on', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);
    const followButton = screen.getByTestId('log-viewer-follow');

    fireEvent.click(followButton);

    expect(followButton).toHaveAttribute('aria-pressed', 'false');
    expect(mockLazyLog.scrollToIndex).not.toHaveBeenCalled();

    fireEvent.click(followButton);

    expect(followButton).toHaveAttribute('aria-pressed', 'true');
    expect(mockLazyLog.scrollToIndex).toHaveBeenCalledWith(2);
  });

  it('resumes following when jump-to-end is used after a manual scroll', () => {
    render(<LogViewerModal {...defaultProps} mode="stream" />);

    act(() => mockLazyLog.onScroll?.(scrolledUp));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    fireEvent.click(screen.getByTestId('log-viewer-jump-to-end'));

    expect(mockLazyLog.scrollToIndex).toHaveBeenCalledWith(2);
    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('re-pins to the tail when a static run goes live', () => {
    const { rerender } = render(
      <LogViewerModal {...defaultProps} mode="stream" />
    );

    fireEvent.click(screen.getByTestId('log-viewer-follow'));

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'false'
    );

    rerender(<LogViewerModal {...defaultProps} mode="static" />);
    rerender(<LogViewerModal {...defaultProps} mode="stream" />);

    expect(screen.getByTestId('log-viewer-follow')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
