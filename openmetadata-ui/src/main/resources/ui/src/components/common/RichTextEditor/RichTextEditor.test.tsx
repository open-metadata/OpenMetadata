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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import RichTextEditor from './RichTextEditor';
import { EditorContentRef } from './RichTextEditor.interface';

jest.mock('../../BlockEditor/BlockEditor', () => {
  return jest.fn().mockImplementation(({ content, onChange, ref }: any) => {
    if (ref && ref.current) {
      ref.current = { editor: { getHTML: jest.fn().mockReturnValue(content) } }; // mock the editor object
    }

    return (
      <textarea
        data-testid="editor-textarea"
        ref={ref as React.Ref<HTMLTextAreaElement>}
        value={content}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    );
  });
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

  it('should return empty string when value is <p></p> format content is empty', () => {
    const editorRef: React.RefObject<EditorContentRef> = React.createRef();
    const initialValue = '<p></p>';

    render(<RichTextEditor initialValue={initialValue} ref={editorRef} />);

    const getEditorContent = editorRef.current?.getEditorContent();

    expect(getEditorContent).toBe('');
  });
});
