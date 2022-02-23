import classNames from 'classnames';
import MarkdownShortcuts from 'quill-markdown-shortcuts';
import React, {
  forwardRef,
  HTMLAttributes,
  useImperativeHandle,
  useState,
} from 'react';
import ReactQuill, { Quill } from 'react-quill';
import { HTMLToMarkdown } from '../../utils/FeedUtils';
import { editorRef } from '../common/rich-text-editor/RichTextEditor.interface';
import './FeedEditor.css';

Quill.register('modules/markdownShortcuts', MarkdownShortcuts);
const Delta = Quill.import('delta');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const strikethrough = (_node: any, delta: typeof Delta) => {
  return delta.compose(new Delta().retain(delta.length(), { strike: true }));
};

const modules = {
  toolbar: {
    container: [
      ['bold', 'italic', 'strike'],
      ['blockquote', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
    ],
  },

  markdownShortcuts: {},
  clipboard: {
    matchers: [['del, strike', strikethrough]],
  },
};

interface FeedEditorProp extends HTMLAttributes<HTMLDivElement> {
  editorClass?: string;
  className?: string;
}

const FeedEditor = forwardRef<editorRef, FeedEditorProp>(
  ({ className, editorClass }: FeedEditorProp, ref) => {
    const [value, setValue] = useState<string>('');
    const onChangeHandler = (value: string) => {
      setValue(value);
    };

    useImperativeHandle(ref, () => ({
      getEditorValue() {
        setValue('');

        return HTMLToMarkdown.turndown(value);
      },
    }));

    return (
      <div className={className}>
        <ReactQuill
          className={classNames('editor-container', editorClass)}
          modules={modules}
          theme="snow"
          value={value}
          onChange={onChangeHandler}
        />
      </div>
    );
  }
);

export default FeedEditor;
