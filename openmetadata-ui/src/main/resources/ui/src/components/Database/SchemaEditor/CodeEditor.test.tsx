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
import { CSMode } from '../../../enums/codemirror.enum';
import CodeEditor from './CodeEditor';

const mockOnChange = jest.fn();
const mockOnFocus = jest.fn();
const mockOnCopyToClipBoard = jest.fn();
const mockRefresh = jest.fn();

jest.mock('../../../constants/constants', () => ({
  JSON_TAB_SIZE: 2,
}));

jest.mock('../../../utils/SchemaEditor.utils', () => ({
  getSchemaEditorValue: jest.fn().mockImplementation((value) => value || ''),
}));

jest.mock('../../../hooks/useClipBoard', () => ({
  useClipboard: jest.fn().mockImplementation(() => ({
    onCopyToClipBoard: mockOnCopyToClipBoard,
    hasCopied: false,
  })),
}));

jest.mock('react-codemirror2', () => ({
  Controlled: jest
    .fn()
    .mockImplementation(
      ({
        value,
        onBeforeChange,
        onChange,
        onFocus,
        editorDidMount,
        options,
        className,
      }) => {
        React.useEffect(() => {
          if (editorDidMount) {
            const mockEditor = {
              refresh: mockRefresh,
              getWrapperElement: () => ({
                remove: jest.fn(),
              }),
            };
            editorDidMount(mockEditor);
          }
        }, [editorDidMount]);

        return (
          <div className={className} data-testid="code-mirror-editor">
            <span data-testid="editor-value">{value}</span>
            <input
              data-testid="code-mirror-input"
              type="text"
              value={value}
              onChange={(e) => {
                if (onBeforeChange) {
                  onBeforeChange(null, null, e.target.value);
                }
                if (onChange) {
                  onChange(null, null, e.target.value);
                }
              }}
              onFocus={onFocus}
            />
            <span data-testid="editor-options">{JSON.stringify(options)}</span>
          </div>
        );
      }
    ),
}));

const defaultProps = {
  value: 'test code',
  onChange: mockOnChange,
  onFocus: mockOnFocus,
};

describe('CodeEditor Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render component with default props', () => {
    render(<CodeEditor />);

    expect(screen.getByTestId('code-mirror-container')).toBeInTheDocument();
    expect(screen.getByTestId('code-mirror-editor')).toBeInTheDocument();
    expect(screen.getByTestId('copy-button-container')).toBeInTheDocument();
    expect(screen.getByTestId('query-copy-button')).toBeInTheDocument();
  });

  it('should render with provided value', () => {
    render(<CodeEditor {...defaultProps} />);

    expect(screen.getByTestId('editor-value')).toHaveTextContent('test code');
  });

  it('should render with custom title', () => {
    const title = 'Custom Editor Title';
    render(<CodeEditor title={title} />);

    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const customClass = 'custom-editor-class';
    render(<CodeEditor className={customClass} />);

    const container = screen.getByTestId('code-mirror-container');

    expect(container).toHaveClass(customClass);
    expect(container).toHaveClass('code-editor-new-style');
  });

  it('should apply custom editorClass', () => {
    const editorClass = 'custom-editor-class';
    render(<CodeEditor editorClass={editorClass} />);

    expect(screen.getByTestId('code-mirror-editor')).toHaveClass(editorClass);
  });

  it('should hide copy button when showCopyButton is false', () => {
    render(<CodeEditor showCopyButton={false} />);

    expect(
      screen.queryByTestId('copy-button-container')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('query-copy-button')).not.toBeInTheDocument();
  });

  it('should call onCopyToClipBoard when copy button is clicked', () => {
    render(<CodeEditor {...defaultProps} />);

    const copyButton = screen.getByTestId('query-copy-button');
    fireEvent.click(copyButton);

    expect(mockOnCopyToClipBoard).toHaveBeenCalledTimes(1);
  });

  it('should call onChange when editor value changes', () => {
    render(<CodeEditor {...defaultProps} />);

    const input = screen.getByTestId('code-mirror-input');
    fireEvent.change(input, { target: { value: 'new code' } });

    expect(mockOnChange).toHaveBeenCalledWith('new code');
  });

  it('should call onFocus when editor is focused', () => {
    render(<CodeEditor {...defaultProps} />);

    const input = screen.getByTestId('code-mirror-input');
    fireEvent.focus(input);

    expect(mockOnFocus).toHaveBeenCalledTimes(1);
  });

  it('should not call onChange when onChange prop is not provided', () => {
    render(<CodeEditor value="test" />);

    const input = screen.getByTestId('code-mirror-input');
    fireEvent.change(input, { target: { value: 'new code' } });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should render with custom mode', () => {
    const customMode = { name: CSMode.SQL, json: false };
    render(<CodeEditor mode={customMode} />);

    const optionsElement = screen.getByTestId('editor-options');
    const options = JSON.parse(optionsElement.textContent || '{}');

    expect(options.mode).toEqual(customMode);
  });

  it('should merge custom options with default options', () => {
    const customOptions = {
      lineNumbers: true,
      readOnly: true,
      customOption: 'test',
    };
    render(<CodeEditor options={customOptions} />);

    const optionsElement = screen.getByTestId('editor-options');
    const options = JSON.parse(optionsElement.textContent || '{}');

    expect(options.lineNumbers).toBe(true);
    expect(options.readOnly).toBe(true);
    expect(options.customOption).toBe('test');
    expect(options.tabSize).toBe(2);
    expect(options.indentUnit).toBe(2);
  });

  it('should refresh editor when refreshEditor prop changes to true', () => {
    jest.useFakeTimers();

    const { rerender } = render(<CodeEditor refreshEditor={false} />);

    rerender(<CodeEditor refreshEditor />);

    jest.advanceTimersByTime(50);

    expect(mockRefresh).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  it('should not refresh editor when refreshEditor prop is false', () => {
    jest.useFakeTimers();

    render(<CodeEditor refreshEditor={false} />);

    jest.advanceTimersByTime(50);

    expect(mockRefresh).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should update internal value when value prop changes', () => {
    const { rerender } = render(<CodeEditor value="initial value" />);

    expect(screen.getByTestId('editor-value')).toHaveTextContent(
      'initial value'
    );

    rerender(<CodeEditor value="updated value" />);

    expect(screen.getByTestId('editor-value')).toHaveTextContent(
      'updated value'
    );
  });

  it('should display copy button correctly', () => {
    render(<CodeEditor />);

    const copyButton = screen.getByTestId('query-copy-button');

    expect(copyButton).toBeInTheDocument();
  });

  it('should handle component lifecycle properly', () => {
    const { unmount } = render(<CodeEditor />);

    expect(() => unmount()).not.toThrow();
  });

  it('should handle default JavaScript mode', () => {
    render(<CodeEditor />);

    const optionsElement = screen.getByTestId('editor-options');
    const options = JSON.parse(optionsElement.textContent || '{}');

    expect(options.mode).toEqual({
      name: CSMode.JAVASCRIPT,
      json: true,
    });
  });

  it('should render without onFocus when not provided', () => {
    render(<CodeEditor value="test" onChange={mockOnChange} />);

    expect(screen.getByTestId('code-mirror-editor')).toBeInTheDocument();
  });
});
