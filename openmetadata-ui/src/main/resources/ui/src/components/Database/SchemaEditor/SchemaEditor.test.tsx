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
import { CSMode } from '../../../enums/codemirror.enum';
import SchemaEditor from './SchemaEditor';

const mockOnChange = jest.fn();
const mockOnCopyToClipBoard = jest.fn();

jest.mock('../../../hooks/useClipBoard', () => ({
  ...jest.requireActual('../../../hooks/useClipBoard'),
  useClipboard: jest
    .fn()
    .mockImplementation(() => ({ onCopyToClipBoard: mockOnCopyToClipBoard })),
}));

// The real editor needs layout APIs JSDOM does not implement. The stub keeps
// the contract SchemaEditor relies on: a value in, edits out, and a view whose
// focus state decides whether an external value is applied now or on blur.
let isEditorFocused = false;

jest.mock('@uiw/react-codemirror', () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');

  return {
    __esModule: true,
    default: forwardRef(
      (
        {
          value,
          extensions,
          onChange,
          onBlur,
          onFocus,
        }: {
          value: string;
          extensions: unknown[];
          onChange?: (value: string) => void;
          onBlur?: () => void;
          onFocus?: () => void;
        },
        ref: unknown
      ) => {
        useImperativeHandle(ref, () => ({
          view: {
            get hasFocus() {
              return isEditorFocused;
            },
          },
        }));

        return (
          <div>
            <span data-testid="editor-value">{value}</span>
            <span data-testid="editor-extension-count">
              {extensions.length}
            </span>
            <input
              data-testid="code-mirror-editor-input"
              value={value}
              onBlur={() => {
                isEditorFocused = false;
                onBlur?.();
              }}
              onChange={(event) => onChange?.(event.target.value)}
              onFocus={() => {
                isEditorFocused = true;
                onFocus?.();
              }}
            />
          </div>
        );
      }
    ),
  };
});

const mockProps = {
  value: 'select 1',
  showCopyButton: true,
  onChange: mockOnChange,
};

const getEditorValue = () => screen.getByTestId('editor-value').textContent;

describe('SchemaEditor component test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isEditorFocused = false;
  });

  it('should render the editor and the copy button', () => {
    render(<SchemaEditor {...mockProps} />);

    expect(screen.getByTestId('code-mirror-container')).toBeInTheDocument();
    expect(screen.getByTestId('query-copy-button')).toBeInTheDocument();
  });

  it('should show the value provided via props', () => {
    render(<SchemaEditor {...mockProps} />);

    expect(getEditorValue()).toBe('select 1');
  });

  it('should hide the copy button when asked', () => {
    render(<SchemaEditor {...mockProps} showCopyButton={false} />);

    expect(screen.queryByTestId('query-copy-button')).not.toBeInTheDocument();
  });

  it('should copy the current buffer', () => {
    render(<SchemaEditor {...mockProps} />);

    fireEvent.click(screen.getByTestId('query-copy-button'));

    expect(mockOnCopyToClipBoard).toHaveBeenCalledWith('select 1');
  });

  it('should format a JSON value on mount when autoFormat is on', () => {
    render(<SchemaEditor {...mockProps} value='{"a":1}' />);

    expect(getEditorValue()).toBe('{\n  "a": 1\n}');
  });

  it('should not format the value on mount when autoFormat is off', () => {
    render(
      <SchemaEditor {...mockProps} autoFormat={false} value='{"a":1}' />
    );

    expect(getEditorValue()).toBe('{"a":1}');
  });

  describe('editing', () => {
    it('should report the formatted value but leave the buffer as typed', () => {
      render(<SchemaEditor {...mockProps} value="" />);

      fireEvent.change(screen.getByTestId('code-mirror-editor-input'), {
        target: { value: '{"a":1}' },
      });

      // Reformatting the buffer mid-edit is what used to move the caret.
      expect(getEditorValue()).toBe('{"a":1}');
      expect(mockOnChange).toHaveBeenCalledWith('{\n  "a": 1\n}');
    });

    it('should ignore the parent echoing the emitted value back', () => {
      const { rerender } = render(<SchemaEditor {...mockProps} value="" />);

      fireEvent.change(screen.getByTestId('code-mirror-editor-input'), {
        target: { value: '{"a":1}' },
      });
      rerender(<SchemaEditor {...mockProps} value={'{\n  "a": 1\n}'} />);

      expect(getEditorValue()).toBe('{"a":1}');
    });
  });

  describe('external value updates', () => {
    it('should apply a new value while the editor is blurred', () => {
      const { rerender } = render(<SchemaEditor {...mockProps} />);

      rerender(<SchemaEditor {...mockProps} value="select 2" />);

      expect(getEditorValue()).toBe('select 2');
    });

    it('should let a later edit win over a value deferred to blur', () => {
      const { rerender } = render(<SchemaEditor {...mockProps} />);
      const input = screen.getByTestId('code-mirror-editor-input');

      fireEvent.focus(input);
      rerender(<SchemaEditor {...mockProps} value="select 2" />);
      fireEvent.change(input, { target: { value: 'select 3' } });
      fireEvent.blur(input);

      expect(getEditorValue()).toBe('select 3');
    });

    it('should apply a value immediately when the editor is read only', () => {
      const { rerender } = render(<SchemaEditor {...mockProps} readOnly />);

      fireEvent.focus(screen.getByTestId('code-mirror-editor-input'));
      rerender(<SchemaEditor {...mockProps} readOnly value="select 2" />);

      expect(getEditorValue()).toBe('select 2');
    });

    it('should defer a value that arrives mid-edit until blur', () => {
      const { rerender } = render(<SchemaEditor {...mockProps} />);
      const input = screen.getByTestId('code-mirror-editor-input');

      fireEvent.focus(input);
      rerender(<SchemaEditor {...mockProps} value="select 2" />);

      expect(getEditorValue()).toBe('select 1');

      fireEvent.blur(input);

      expect(getEditorValue()).toBe('select 2');
    });
  });

  it('should append the extensions passed by the call site', () => {
    const extensions = [[], []];
    const { rerender } = render(<SchemaEditor {...mockProps} />);
    const baseCount = Number(
      screen.getByTestId('editor-extension-count').textContent
    );

    rerender(<SchemaEditor {...mockProps} extensions={extensions} />);

    expect(
      Number(screen.getByTestId('editor-extension-count').textContent)
    ).toBe(baseCount + extensions.length);
  });

  it('should build a language extension for the requested mode', () => {
    render(<SchemaEditor {...mockProps} mode={{ name: CSMode.SQL }} />);

    expect(
      Number(screen.getByTestId('editor-extension-count').textContent)
    ).toBeGreaterThan(0);
  });
});
