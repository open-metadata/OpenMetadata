import { Editor, EditorChange } from 'codemirror';
import 'codemirror/addon/edit/closebrackets.js';
import 'codemirror/addon/edit/matchbrackets.js';
import 'codemirror/addon/fold/brace-fold';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/fold/foldgutter.js';
import 'codemirror/addon/selection/active-line';
import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/javascript/javascript';
import React, { useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import { JSON_TAB_SIZE } from '../../constants/constants';
import { getSchemaEditorValue } from './SchemaEditor.utils';

const options = {
  tabSize: JSON_TAB_SIZE,
  indentUnit: JSON_TAB_SIZE,
  indentWithTabs: false,
  lineNumbers: true,
  lineWrapping: true,
  styleActiveLine: true,
  matchBrackets: true,
  autoCloseBrackets: true,
  foldGutter: true,
  gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
  mode: {
    name: 'javascript',
    json: true,
  },
  readOnly: true,
};

const SchemaEditor = ({ value }: { value: string }) => {
  const [internalValue, setInternalValue] = useState(
    getSchemaEditorValue(value)
  );
  const handleEditorInputBeforeChange = (
    _editor: Editor,
    _data: EditorChange,
    value: string
  ): void => {
    setInternalValue(getSchemaEditorValue(value));
  };

  return (
    <div>
      <CodeMirror
        options={options}
        value={internalValue}
        onBeforeChange={handleEditorInputBeforeChange}
      />
    </div>
  );
};

export default SchemaEditor;
