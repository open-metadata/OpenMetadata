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
import CopyButton from './CopyButton';

const mockWriteText = jest.fn().mockResolvedValue(undefined);

beforeAll(() => {
  Object.defineProperty(window, 'isSecureContext', {
    value: true,
    configurable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mockWriteText },
    configurable: true,
  });
});

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest
    .fn()
    .mockImplementation(
      ({
        children,
        className,
        iconLeading: Icon,
        isDisabled,
        onClick,
        'data-testid': testId,
      }) => (
        <button
          className={className}
          data-testid={testId}
          disabled={isDisabled}
          onClick={onClick}>
          {typeof Icon === 'function' ? <Icon /> : Icon}
          {children}
        </button>
      )
    ),
  ButtonUtility: jest
    .fn()
    .mockImplementation(
      ({
        icon: Icon,
        className,
        isDisabled,
        onClick,
        tooltip,
        'data-testid': testId,
      }) => (
        <button
          aria-label={tooltip}
          className={className}
          data-testid={testId}
          disabled={isDisabled}
          onClick={onClick}>
          {typeof Icon === 'function' ? <Icon /> : Icon}
        </button>
      )
    ),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Check: () => <svg data-testid="check-icon" />,
  Copy01: () => <svg data-testid="copy-icon" />,
}));

const clickAndSettle = async (testId: string) => {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
  });
};

describe('CopyButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('copies the value and swaps to the success state', async () => {
    render(<CopyButton value="https://example.com/memory" />);

    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
    expect(screen.getByTestId('copy-link-btn').className).toContain(
      'tw:rounded-md'
    );

    await clickAndSettle('copy-link-btn');

    expect(mockWriteText).toHaveBeenCalledWith('https://example.com/memory');
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('copy-icon')).not.toBeInTheDocument();
    expect(screen.getByTestId('copy-link-btn').className).toContain(
      'tw:bg-success-solid'
    );
    expect(screen.getByTestId('copy-link-btn').className).toContain(
      'tw:rounded-full'
    );
    expect(screen.getByTestId('copy-link-btn')).toHaveAttribute(
      'aria-label',
      'label.copied'
    );
  });

  it('uses the given test id and tooltip as the accessible name', () => {
    render(
      <CopyButton testId="copy-secret" tooltip="Copy token" value="secret" />
    );

    expect(screen.getByTestId('copy-secret')).toHaveAttribute(
      'aria-label',
      'Copy token'
    );
  });

  it('does not let the click reach a clickable parent row', async () => {
    const onRowClick = jest.fn();
    render(
      // A clickable table row; the a11y rules do not apply to this test fixture.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={onRowClick}>
        <CopyButton value="row-link" />
      </div>
    );

    await clickAndSettle('copy-link-btn');

    expect(mockWriteText).toHaveBeenCalledWith('row-link');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('calls onCopy after a successful copy', async () => {
    const onCopy = jest.fn();
    render(<CopyButton value="abc" onCopy={onCopy} />);

    await clickAndSettle('copy-link-btn');

    expect(onCopy).toHaveBeenCalledTimes(1);
  });

  it('renders the labeled variant and flips the label to Copied', async () => {
    render(<CopyButton label="Copy" testId="copy-token" value="jwt" />);

    expect(screen.getByTestId('copy-token')).toHaveTextContent('Copy');

    await clickAndSettle('copy-token');

    expect(mockWriteText).toHaveBeenCalledWith('jwt');
    expect(screen.getByTestId('copy-token')).toHaveTextContent('label.copied');
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    expect(screen.getByTestId('copy-token').className).toContain(
      'tw:bg-success-solid'
    );
  });

  it('passes isDisabled through so an empty value cannot be copied', () => {
    render(<CopyButton isDisabled label="Copy" testId="copy-log" value="" />);

    expect(screen.getByTestId('copy-log')).toBeDisabled();
  });
});
