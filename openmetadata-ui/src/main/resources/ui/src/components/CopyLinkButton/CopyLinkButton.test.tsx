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
import CopyLinkButton from './CopyLinkButton.component';

const mockOnCopyToClipBoard = jest.fn();

jest.mock('../../hooks/useClipBoard', () => ({
  useClipboard: jest.fn().mockImplementation(() => ({
    onCopyToClipBoard: mockOnCopyToClipBoard,
    hasCopied: false,
  })),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ButtonUtility: jest
    .fn()
    .mockImplementation(
      ({ icon, onClick, className, 'data-testid': testId }) => (
        <button className={className} data-testid={testId} onClick={onClick}>
          {icon}
        </button>
      )
    ),
  Tooltip: jest.fn().mockImplementation(({ children }) => <>{children}</>),
  TooltipTrigger: jest
    .fn()
    .mockImplementation(({ children }) => <>{children}</>),
}));

jest.mock('@untitledui/icons', () => ({
  Check: jest.fn().mockImplementation(() => <svg data-testid="check-icon" />),
}));

const renderComponent = (props = {}) =>
  render(
    <CopyLinkButton url="https://example.com/page?memory=test" {...props}>
      <svg data-testid="link-icon" />
    </CopyLinkButton>
  );

describe('CopyLinkButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the button with the children icon in idle state', () => {
    renderComponent();

    expect(screen.getByTestId('copy-link-btn')).toBeInTheDocument();
    expect(screen.getByTestId('link-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('check-icon')).not.toBeInTheDocument();
  });

  it('calls onCopyToClipBoard when the button is clicked', () => {
    renderComponent();

    fireEvent.click(screen.getByTestId('copy-link-btn'));

    expect(mockOnCopyToClipBoard).toHaveBeenCalledTimes(1);
  });

  it('shows the check icon and hides children when hasCopied is true', () => {
    const { useClipboard } = require('../../hooks/useClipBoard');
    useClipboard.mockReturnValueOnce({
      onCopyToClipBoard: mockOnCopyToClipBoard,
      hasCopied: true,
    });

    renderComponent();

    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('link-icon')).not.toBeInTheDocument();
  });

  it('applies the success class when hasCopied is true', () => {
    const { useClipboard } = require('../../hooks/useClipBoard');
    useClipboard.mockReturnValueOnce({
      onCopyToClipBoard: mockOnCopyToClipBoard,
      hasCopied: true,
    });

    renderComponent();

    expect(screen.getByTestId('copy-link-btn').className).toContain(
      'tw:bg-success-600'
    );
  });

  it('applies the round class in idle state', () => {
    renderComponent();

    expect(screen.getByTestId('copy-link-btn').className).toContain(
      'tw:rounded-full'
    );
  });

  it('passes the url to useClipboard', () => {
    const { useClipboard } = require('../../hooks/useClipBoard');
    const url = 'https://example.com/page?memory=my-memory';

    renderComponent({ url });

    expect(useClipboard).toHaveBeenCalledWith(url, 1200);
  });

  it('uses the custom tooltip prop when provided', () => {
    const { useClipboard } = require('../../hooks/useClipBoard');
    const { Tooltip } = require('@openmetadata/ui-core-components');
    useClipboard.mockReturnValue({
      onCopyToClipBoard: mockOnCopyToClipBoard,
      hasCopied: false,
    });

    renderComponent({ tooltip: 'Custom tooltip text' });

    expect(Tooltip).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Custom tooltip text' }),
      expect.anything()
    );
  });

  it('disables the tooltip when hasCopied is true', () => {
    const { useClipboard } = require('../../hooks/useClipBoard');
    const { Tooltip } = require('@openmetadata/ui-core-components');
    useClipboard.mockReturnValueOnce({
      onCopyToClipBoard: mockOnCopyToClipBoard,
      hasCopied: true,
    });

    renderComponent();

    expect(Tooltip).toHaveBeenCalledWith(
      expect.objectContaining({ isDisabled: true }),
      expect.anything()
    );
  });
});
