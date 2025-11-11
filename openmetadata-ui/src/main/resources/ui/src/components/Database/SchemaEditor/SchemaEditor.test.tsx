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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import SchemaEditor from './SchemaEditor';

const mockOnChange = jest.fn();
const mockOnCopyToClipBoard = jest.fn();

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
  Controlled: jest.fn().mockImplementation(({ value, onChange }) => (
    <div>
      <span>{value}</span>
      <input
        data-testid="code-mirror-editor-input"
        type="text"
        onChange={onChange}
      />
    </div>
  )),
}));

const mockProps = {
  value: 'test SQL query',
  showCopyButton: true,
  onChange: mockOnChange,
};

describe('SchemaEditor component test', () => {
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

  it('Should call refreshEditor', async () => {
    jest.useFakeTimers();
    const mockEditor = {
      refresh: jest.fn(),
    };

    jest.spyOn(React, 'useRef').mockReturnValue({
      current: mockEditor,
    });

    render(<SchemaEditor {...mockProps} refreshEditor />);

    // Fast-forward timers to trigger the refresh
    jest.advanceTimersByTime(50);

    expect(mockEditor.refresh).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('Should not call refresh if refreshEditor is false', async () => {
    jest.useFakeTimers();
    const mockEditor = {
      refresh: jest.fn(),
    };

    jest.spyOn(React, 'useRef').mockReturnValue({
      current: mockEditor,
    });

    render(<SchemaEditor {...mockProps} refreshEditor={false} />);

    // Fast-forward timers to trigger the refresh
    jest.advanceTimersByTime(50);

    expect(mockEditor.refresh).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
