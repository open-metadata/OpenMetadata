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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@melloware/react-logviewer', () => ({
  LazyLog: ({
    text,
    follow,
    enableSearch,
  }: {
    text: string;
    follow?: boolean;
    enableSearch?: boolean;
  }) => (
    <pre
      data-follow={String(follow)}
      data-search={String(enableSearch)}
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
  ButtonUtility: ({
    icon: _icon,
    tooltip,
    onClick,
    'data-testid': testId,
  }: {
    icon: unknown;
    tooltip?: string;
    onClick?: () => void;
    'data-testid'?: string;
  }) => (
    <button aria-label={tooltip} data-testid={testId} onClick={onClick}>
      icon
    </button>
  ),
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

jest.mock('../CopyToClipboardButton/CopyToClipboardButton', () => ({
  __esModule: true,
  default: ({ copyText }: { copyText: string }) => (
    <button data-copytext={copyText} data-testid="copy-button">
      copy
    </button>
  ),
}));

jest.mock('../Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader">loading</div>,
}));

const defaultProps = {
  logs: 'line-one\nline-two',
  onClose: jest.fn(),
  open: true,
  title: 'Auto-document workflow · logs',
};

describe('LogViewerModal', () => {
  it('renders the title and logs when open', () => {
    render(<LogViewerModal {...defaultProps} />);

    expect(screen.getByTestId('log-viewer-title')).toHaveTextContent(
      'Auto-document workflow · logs'
    );
    expect(screen.getByTestId('lazy-log')).toHaveTextContent('line-one');
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

  it('shows the copy button by default and hides it when enableCopy is false', () => {
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(screen.getByTestId('copy-button')).toBeInTheDocument();

    rerender(<LogViewerModal {...defaultProps} enableCopy={false} />);

    expect(screen.queryByTestId('copy-button')).not.toBeInTheDocument();
  });

  it('renders the download button only when onDownload is provided and fires it', () => {
    const onDownload = jest.fn();
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(screen.queryByTestId('log-viewer-download')).not.toBeInTheDocument();

    rerender(<LogViewerModal {...defaultProps} onDownload={onDownload} />);
    fireEvent.click(screen.getByTestId('log-viewer-download'));

    expect(onDownload).toHaveBeenCalledTimes(1);
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

  it('passes the enableSearch flag through to the log viewer', () => {
    const { rerender } = render(<LogViewerModal {...defaultProps} />);

    expect(screen.getByTestId('lazy-log')).toHaveAttribute(
      'data-search',
      'true'
    );

    rerender(<LogViewerModal {...defaultProps} enableSearch={false} />);

    expect(screen.getByTestId('lazy-log')).toHaveAttribute(
      'data-search',
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
});
