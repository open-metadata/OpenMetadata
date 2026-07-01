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
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import LogViewerModal from './LogViewerModal.component';

const onCopyToClipBoard = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@melloware/react-logviewer', () => ({
  LazyLog: ({
    text,
    follow,
    formatPart,
  }: {
    text: string;
    follow?: boolean;
    formatPart?: (text: string) => ReactNode;
  }) => (
    <pre
      data-colorized={String(Boolean(formatPart))}
      data-follow={String(follow)}
      data-testid="lazy-log">
      {text}
    </pre>
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
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
  Copy01: () => <span data-testid="icon-copy" />,
  Download01: () => <span data-testid="icon-download" />,
  File02: () => <span data-testid="icon-file" />,
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
