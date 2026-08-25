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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CopyToClipboardButton } from './CopyToClipboardButton';

jest.mock('@openmetadata/ui-core-components', () => ({
  Tooltip: jest.fn().mockImplementation(({ children, title }) => (
    <div data-testid="tooltip" data-title={title}>
      {children}
    </div>
  )),
  TooltipTrigger: jest
    .fn()
    .mockImplementation(({ children }) => <>{children}</>),
  ButtonUtility: jest
    .fn()
    .mockImplementation(({ icon, onClick, 'data-testid': testId }) => (
      <button data-testid={testId} onClick={onClick}>
        {icon}
      </button>
    )),
}));

const clipboardWriteTextMock = jest.fn().mockResolvedValue(undefined);
const clipboardMock = {
  writeText: clipboardWriteTextMock,
};

const value = 'Test Value';
const callBack = jest.fn();

Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: clipboardMock,
  writable: true,
});

Object.defineProperty(globalThis, 'isSecureContext', {
  value: true,
  writable: true,
});

describe('Test CopyToClipboardButton Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clipboardWriteTextMock.mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: clipboardMock,
      writable: true,
    });
  });

  it('Should render all child elements', async () => {
    render(<CopyToClipboardButton copyText={value} />);

    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
    expect(screen.getByTestId('copy-secret')).toBeInTheDocument();
  });

  it('Should calls onCopy callback when clicked', async () => {
    render(<CopyToClipboardButton copyText={value} onCopy={callBack} />);

    fireEvent.click(screen.getByTestId('copy-secret'));

    await waitFor(() => expect(callBack).toHaveBeenCalled());
  });

  it('Should show copied message in tooltip after click', async () => {
    jest.useFakeTimers();
    render(<CopyToClipboardButton copyText={value} />);

    fireEvent.click(screen.getByTestId('copy-secret'));

    await waitFor(() => {
      expect(screen.getByTestId('tooltip')).toHaveAttribute(
        'data-title',
        'message.copied-to-clipboard'
      );
    });

    jest.useRealTimers();
  });

  it('Should show default copy message in tooltip before click', () => {
    render(<CopyToClipboardButton copyText={value} />);

    expect(screen.getByTestId('tooltip')).toHaveAttribute(
      'data-title',
      'message.copy-to-clipboard'
    );
  });

  it('Should have copied text in clipboard', async () => {
    render(<CopyToClipboardButton copyText={value} />);

    fireEvent.click(screen.getByTestId('copy-secret'));

    await waitFor(() =>
      expect(clipboardWriteTextMock).toHaveBeenCalledWith(value)
    );
  });

  it('Should handles error when cannot access clipboard API', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: undefined,
      writable: true,
    });

    render(<CopyToClipboardButton copyText={value} />);

    fireEvent.click(screen.getByTestId('copy-secret'));

    await waitFor(() => {
      expect(screen.getByTestId('tooltip')).toHaveAttribute(
        'data-title',
        'message.copy-to-clipboard'
      );
    });
  });

  it('Should render button with correct testid', () => {
    render(<CopyToClipboardButton copyText={value} position="top" />);

    expect(screen.getByTestId('copy-secret')).toBeInTheDocument();
  });
});
