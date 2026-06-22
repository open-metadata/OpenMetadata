import { fireEvent, render, screen } from '@testing-library/react';
import LogViewerModal from './LogViewerModal.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@melloware/react-logviewer', () => ({
  LazyLog: ({ text, follow }: { text: string; follow?: boolean }) => (
    <pre data-follow={String(follow)} data-testid="lazy-log">
      {text}
    </pre>
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ModalOverlay: ({ children, isOpen }: { children: ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="modal-overlay">{children}</div> : null,
  Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ButtonUtility: ({
    icon,
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
    'data-testid': testId,
  }: {
    onPress?: () => void;
    'data-testid'?: string;
  }) => (
    <button data-testid={testId} onClick={onPress}>
      close
    </button>
  ),
}));

jest.mock('react-aria-components', () => ({
  Dialog: ({ children, className }: { children: ReactNode; className?: string }) => (
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

import { ReactNode } from 'react';

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

    expect(screen.getByTestId('lazy-log')).toHaveAttribute('data-follow', 'true');
  });
});
