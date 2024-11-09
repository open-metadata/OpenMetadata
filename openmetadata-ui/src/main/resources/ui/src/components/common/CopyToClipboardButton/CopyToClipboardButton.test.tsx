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
import CopyToClipboardButton from './CopyToClipboardButton';

const clipboardWriteTextMock = jest.fn();
const clipboardMock = {
  writeText: clipboardWriteTextMock,
};

const value = 'Test Value';
const callBack = jest.fn();

Object.defineProperty(window.navigator, 'clipboard', {
  value: clipboardMock,
  writable: true,
});

describe('Test CopyToClipboardButton Component', () => {
  it('Should render all child elements', async () => {
    render(<CopyToClipboardButton copyText={value} />);

    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
    expect(screen.getByTestId('copy-secret')).toBeInTheDocument();
  });

  it('Should calls onCopy callback when clicked', async () => {
    render(<CopyToClipboardButton copyText={value} onCopy={callBack} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-secret'));
    });

    expect(callBack).toHaveBeenCalled();
  });

  it('Should show success message on clipboard click', async () => {
    jest.useFakeTimers();
    render(<CopyToClipboardButton copyText={value} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-secret'));
    });

    fireEvent.mouseOver(screen.getByTestId('copy-secret'));
    jest.advanceTimersByTime(1000);

    expect(screen.getByTestId('copy-success')).toBeInTheDocument();
  });

  it('Should have copied text in clipboard', async () => {
    render(<CopyToClipboardButton copyText={value} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-secret'));
    });

    // clipboard should have the copied text
    expect(clipboardWriteTextMock).toHaveBeenCalledWith(value);
  });

  it('Should handles error when cannot access clipboard API', async () => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: undefined,
      writable: true,
    });

    render(<CopyToClipboardButton copyText={value} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-secret'));
    });

    // not show the success message if clipboard API has error
    expect(screen.queryByTestId('copy-success')).not.toBeInTheDocument();
  });
});
