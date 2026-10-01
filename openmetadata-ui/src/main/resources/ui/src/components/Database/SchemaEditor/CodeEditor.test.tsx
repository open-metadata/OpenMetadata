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

import { language } from '@codemirror/language';
import { EditorState, Extension } from '@codemirror/state';
import { fireEvent, render, screen } from '@testing-library/react';
import { CSMode } from '../../../enums/codemirror.enum';
import CodeEditor from './CodeEditor';

const mockOnChange = jest.fn();
const mockOnFocus = jest.fn();
const mockOnCopyToClipBoard = jest.fn();

jest.mock('../../../hooks/useClipBoard', () => ({
  useClipboard: jest.fn().mockImplementation(() => ({
    onCopyToClipBoard: mockOnCopyToClipBoard,
    hasCopied: false,
  })),
}));

// The real editor needs layout APIs JSDOM does not implement. The stub keeps the
// contract CodeEditor relies on and records the extensions it was configured
// with, so the tests can assert on the resulting editor state.
let lastExtensions: Extension[] = [];

jest.mock('@uiw/react-codemirror', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');

  return {
    __esModule: true,
    default: forwardRef(
      (
        {
          value,
          className,
          extensions,
          onChange,
          onFocus,
        }: {
          value: string;
          className?: string;
          extensions: Extension[];
          onChange?: (value: string) => void;
          onFocus?: () => void;
        },
        ref: unknown
      ) => {
        lastExtensions = extensions;
        useImperativeHandle(ref, () => ({ view: { hasFocus: false } }));

        return (
          <div className={className} data-testid="code-mirror-editor">
            <span data-testid="editor-value">{value}</span>
            <input
              aria-label="code editor"
              data-testid="code-mirror-input"
              type="text"
              value={value}
              onChange={(event) => onChange?.(event.target.value)}
              onFocus={onFocus}
            />
          </div>
        );
      }
    ),
  };
});

const defaultProps = {
  value: 'test code',
  onChange: mockOnChange,
  onFocus: mockOnFocus,
};

const createState = () => EditorState.create({ extensions: lastExtensions });

describe('CodeEditor Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastExtensions = [];
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

  it('should copy the current buffer when the copy button is clicked', () => {
    render(<CodeEditor {...defaultProps} />);

    fireEvent.click(screen.getByTestId('query-copy-button'));

    expect(mockOnCopyToClipBoard).toHaveBeenCalledWith('test code');
  });

  it('should call onChange when editor value changes', () => {
    render(<CodeEditor {...defaultProps} />);

    fireEvent.change(screen.getByTestId('code-mirror-input'), {
      target: { value: 'new code' },
    });

    expect(mockOnChange).toHaveBeenCalledWith('new code');
  });

  it('should call onFocus when editor is focused', () => {
    render(<CodeEditor {...defaultProps} />);

    fireEvent.focus(screen.getByTestId('code-mirror-input'));

    expect(mockOnFocus).toHaveBeenCalledTimes(1);
  });

  it('should not throw when onChange prop is not provided', () => {
    render(<CodeEditor value="test" />);

    fireEvent.change(screen.getByTestId('code-mirror-input'), {
      target: { value: 'new code' },
    });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should update the buffer when the value prop changes', () => {
    const { rerender } = render(<CodeEditor value="initial value" />);

    expect(screen.getByTestId('editor-value')).toHaveTextContent(
      'initial value'
    );

    rerender(<CodeEditor value="updated value" />);

    expect(screen.getByTestId('editor-value')).toHaveTextContent(
      'updated value'
    );
  });

  it('should unmount without throwing', () => {
    const { unmount } = render(<CodeEditor />);

    expect(() => unmount()).not.toThrow();
  });

  describe('editor configuration', () => {
    it('should default to the json language', () => {
      render(<CodeEditor />);

      expect(createState().facet(language)?.name).toBe('json');
    });

    it('should use the language of the requested mode', () => {
      render(<CodeEditor mode={{ name: CSMode.SQL, json: false }} />);

      expect(createState().facet(language)?.name).toBe('sql');
    });

    it('should keep the default tab size', () => {
      render(<CodeEditor />);

      expect(createState().tabSize).toBe(2);
    });

    it('should be editable by default', () => {
      render(<CodeEditor />);

      expect(createState().readOnly).toBe(false);
    });

    it.each([
      ['the readOnly prop', { readOnly: true }],
      ['a readOnly option', { options: { readOnly: true } }],
    ])('should be read only with %s', (_, props) => {
      render(<CodeEditor {...props} />);

      expect(createState().readOnly).toBe(true);
    });
  });
});
