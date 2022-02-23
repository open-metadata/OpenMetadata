import MarkdownShortcuts from 'quill-markdown-shortcuts';
import React, { FC, HTMLAttributes, useState } from 'react';
import ReactQuill, { Quill } from 'react-quill';
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
  onSave?: (value: string) => void;
}

const FeedEditor: FC<FeedEditorProp> = ({ className }) => {
  const [value, setValue] = useState<string>('');
  const onChangeHandler = (value: string) => {
    setValue(value);
  };

  return (
    <div className={className}>
      <ReactQuill
        className="editor-container"
        modules={modules}
        theme="snow"
        value={value}
        onChange={onChangeHandler}
      />
    </div>
  );
};

export default FeedEditor;
