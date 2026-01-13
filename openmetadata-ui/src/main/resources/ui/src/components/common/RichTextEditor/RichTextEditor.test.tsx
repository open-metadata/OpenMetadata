/*
 *  Copyright 2025 Collate.
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
import RichTextEditor from './RichTextEditor';
import { EditorContentRef } from './RichTextEditor.interface';

// Mock the BlockEditorUtils
jest.mock('../../../utils/BlockEditorUtils', () => ({
  ...jest.requireActual('../../../utils/BlockEditorUtils'),
  setEditorContent: jest.fn((editor, content) => {
    if (editor && editor.commands) {
      editor.commands.setContent(content);
    }
  }),
}));

interface BlockEditorMockProps {
  content?: string;
  onChange?: (content: string) => void;
  autoFocus?: boolean;
  editable?: boolean;
  placeholder?: string;
  extensionOptions?: Record<string, unknown>;
  showMenu?: boolean;
  onFocus?: () => void;
}

// Store the last props passed to BlockEditor for testing
let lastBlockEditorProps: BlockEditorMockProps = {};

jest.mock('../../BlockEditor/BlockEditor', () => {
  const MockBlockEditor = React.forwardRef(
    (props: BlockEditorMockProps, ref) => {
      const { content, onChange, onFocus } = props;
      // Store props for assertions
      lastBlockEditorProps = props;

      const [value, setValue] = React.useState(content || '');
      const textareaRef = React.useRef<HTMLTextAreaElement>(null);

      React.useImperativeHandle(ref, () => ({
        editor: {
          getHTML: () => {
            return textareaRef.current?.value ?? value;
          },
          commands: {
            setContent: (newContent: string) => {
              setValue(newContent);
              if (textareaRef.current) {
                textareaRef.current.value = newContent;
                onChange && onChange(newContent);
              }
            },
          },
        },
      }));

      return (
        <textarea
          data-testid="editor-textarea"
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            onChange && onChange(e.target.value);
          }}
          onFocus={onFocus}
        />
      );
    }
  );

  MockBlockEditor.displayName = 'BlockEditor';

  return MockBlockEditor;
});

const onTextChangeMock = jest.fn();

describe('RichTextEditor', () => {
  it('renders without crashing', () => {
    render(<RichTextEditor onTextChange={onTextChangeMock} />);
    const editorElement = screen.getByTestId('editor');

    expect(editorElement).toBeInTheDocument();
  });

  it('Passes initialValue prop correctly to BlockEditor', () => {
    const initialValue = 'Initial content';
    render(
      <RichTextEditor
        initialValue={initialValue}
        onTextChange={onTextChangeMock}
      />
    );

    const textarea = screen.getByTestId('editor-textarea');

    expect(textarea).toHaveValue(initialValue);
  });

  it('should trigger onTextChange when content changes', () => {
    render(<RichTextEditor onTextChange={onTextChangeMock} />);

    fireEvent.change(screen.getByTestId('editor-textarea'), {
      target: { value: 'New content' },
    });

    expect(onTextChangeMock).toHaveBeenCalledWith('New content');
  });

  it('should trigger onTextChange with empty content in case of value is <p></p> tags)', () => {
    render(<RichTextEditor onTextChange={onTextChangeMock} />);

    fireEvent.change(screen.getByTestId('editor-textarea'), {
      target: { value: '<p></p>' },
    });

    expect(onTextChangeMock).toHaveBeenCalledWith('');
  });

  it('should return content correctly via getEditorContent', () => {
    const editorRef: React.RefObject<EditorContentRef> = React.createRef();
    const initialValue = 'Test content';

    render(<RichTextEditor initialValue={initialValue} ref={editorRef} />);

    // Ref should be set immediately after render
    expect(editorRef.current).toBeDefined();

    const getEditorContent = editorRef.current?.getEditorContent();

    expect(getEditorContent).toBe('Test content');
  });

  it('should apply custom className', () => {
    const customClass = 'custom-editor-class';
    render(
      <RichTextEditor className={customClass} onTextChange={onTextChangeMock} />
    );

    const editorElement = screen.getByTestId('editor');

    expect(editorElement).toHaveClass(customClass);
  });

  it('should apply custom styles', () => {
    const customStyle = { backgroundColor: 'red', padding: '10px' };
    render(
      <RichTextEditor style={customStyle} onTextChange={onTextChangeMock} />
    );

    const editorElement = screen.getByTestId('editor');

    expect(editorElement).toHaveStyle(customStyle);
  });

  it('should pass placeHolder prop to BlockEditor', () => {
    const placeholder = 'Enter description here...';

    render(
      <RichTextEditor
        placeHolder={placeholder}
        onTextChange={onTextChangeMock}
      />
    );

    expect(lastBlockEditorProps.placeholder).toBe(placeholder);
  });

  it('should pass autofocus prop to BlockEditor', () => {
    render(<RichTextEditor autofocus onTextChange={onTextChangeMock} />);

    expect(lastBlockEditorProps.autoFocus).toBe(true);
  });

  it('should pass readonly prop as editable false to BlockEditor', () => {
    render(<RichTextEditor readonly onTextChange={onTextChangeMock} />);

    expect(lastBlockEditorProps.editable).toBe(false);
  });

  it('should pass showMenu prop to BlockEditor', () => {
    render(<RichTextEditor showMenu={false} onTextChange={onTextChangeMock} />);

    expect(lastBlockEditorProps.showMenu).toBe(false);
  });

  it('should pass extensionOptions to BlockEditor', () => {
    const extensionOptions = {
      enableHandlebars: true,
      coreExtensions: true,
      utilityExtensions: true,
      tableExtensions: true,
      advancedContextExtensions: true,
    };

    render(
      <RichTextEditor
        extensionOptions={extensionOptions}
        onTextChange={onTextChangeMock}
      />
    );

    expect(lastBlockEditorProps.extensionOptions).toEqual(extensionOptions);
  });

  it('should default showMenu to true', () => {
    render(<RichTextEditor onTextChange={onTextChangeMock} />);

    expect(lastBlockEditorProps.showMenu).toBe(true);
  });

  it('should default autofocus to false', () => {
    render(<RichTextEditor onTextChange={onTextChangeMock} />);

    expect(lastBlockEditorProps.autoFocus).toBe(false);
  });

  it('should call clearEditorContent via ref', () => {
    const editorRef: React.RefObject<EditorContentRef> = React.createRef();

    render(
      <RichTextEditor
        initialValue="Initial content"
        ref={editorRef}
        onTextChange={onTextChangeMock}
      />
    );

    // Ref should be set immediately after render
    expect(editorRef.current).toBeDefined();

    act(() => {
      editorRef.current?.clearEditorContent();
    });

    expect(editorRef.current?.getEditorContent()).toBe('');
  });

  it('should call setEditorContent via ref', () => {
    const editorRef: React.RefObject<EditorContentRef> = React.createRef();

    render(
      <RichTextEditor
        initialValue="Something"
        ref={editorRef}
        onTextChange={onTextChangeMock}
      />
    );

    expect(editorRef.current?.getEditorContent()).toBe('Something');

    act(() => {
      editorRef.current?.setEditorContent('New content');
    });

    expect(editorRef.current?.getEditorContent()).toBe('New content');
  });

  it('should handle onTextChange not being provided', () => {
    render(<RichTextEditor />);

    const textarea = screen.getByTestId('editor-textarea');

    expect(() => {
      fireEvent.change(textarea, {
        target: { value: 'New content' },
      });
    }).not.toThrow();
  });

  it('should set menuType to bar', () => {
    render(<RichTextEditor onTextChange={onTextChangeMock} />);

    expect(lastBlockEditorProps.menuType).toBe('bar');
  });

  it('should handle HTML content with formatValueBasedOnContent', () => {
    render(<RichTextEditor onTextChange={onTextChangeMock} />);

    fireEvent.change(screen.getByTestId('editor-textarea'), {
      target: { value: '<p>Test content</p>' },
    });

    expect(onTextChangeMock).toHaveBeenCalled();
  });

  it('should handle multiple content changes', () => {
    render(<RichTextEditor onTextChange={onTextChangeMock} />);

    const textarea = screen.getByTestId('editor-textarea');

    fireEvent.change(textarea, { target: { value: 'First change' } });
    fireEvent.change(textarea, { target: { value: 'Second change' } });
    fireEvent.change(textarea, { target: { value: 'Third change' } });

    expect(onTextChangeMock).toHaveBeenCalledTimes(3);
  });

  it('should handle ref methods without editor being initialized', () => {
    const editorRef: React.RefObject<EditorContentRef> = React.createRef();

    render(<RichTextEditor ref={editorRef} />);

    expect(() => {
      editorRef.current?.getEditorContent();
      editorRef.current?.clearEditorContent();
      editorRef.current?.setEditorContent('test');
    }).not.toThrow();
  });

  it('should render without initialValue', () => {
    render(<RichTextEditor onTextChange={onTextChangeMock} />);

    const textarea = screen.getByTestId('editor-textarea');

    expect(textarea).toHaveValue('');
  });

  it('should render in editable mode by default', () => {
    render(<RichTextEditor onTextChange={onTextChangeMock} />);

    expect(lastBlockEditorProps.editable).toBe(true);
  });

  it('should pass onFocus prop to BlockEditor', () => {
    const onFocusMock = jest.fn();
    render(<RichTextEditor onFocus={onFocusMock} />);

    expect(lastBlockEditorProps.onFocus).toBe(onFocusMock);
  });

  it('should trigger onFocus when editor receives focus', () => {
    const onFocusMock = jest.fn();
    render(<RichTextEditor onFocus={onFocusMock} />);

    const textarea = screen.getByTestId('editor-textarea');
    fireEvent.focus(textarea);

    expect(onFocusMock).toHaveBeenCalled();
  });
});
