/*
 *  Copyright 2026 Collate.
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

import { closeBrackets } from '@codemirror/autocomplete';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import {
  bracketMatching,
  foldGutter,
  indentUnit,
  StreamLanguage,
} from '@codemirror/language';
import { java } from '@codemirror/legacy-modes/mode/clike';
import { EditorState, Extension } from '@codemirror/state';
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
  placeholder as placeholderExtension,
} from '@codemirror/view';
import { isUndefined } from 'lodash';
import { Mode } from '../components/Database/SchemaEditor/SchemaEditor.interface';
import { CSMode } from '../enums/codemirror.enum';
import { CodeMirrorOptions } from '../interface/codemirror.interface';

/**
 * Translate the `mode` prop (CodeMirror 5 shape) to a CodeMirror 6 language
 * extension.
 *
 * `CSMode.CLIKE` exists only to render Java (`Language.Java`), which has no
 * Lezer grammar in core; the legacy stream parser covers it.
 *
 * An unknown mode name yields no language extension — the same plain-text
 * rendering CodeMirror 5 gave for a mode whose script was never loaded.
 */
export const getCodeMirrorLanguage = (mode?: Mode): Extension[] => {
  switch (mode?.name) {
    case CSMode.JAVASCRIPT:
      // CodeMirror 5 highlighted JSON with the javascript mode plus `json: true`.
      return mode.json ? [json()] : [javascript()];
    case CSMode.SQL:
      return [sql()];
    case CSMode.PYTHON:
      return [python()];
    case CSMode.YAML:
      return [yaml()];
    case CSMode.CLIKE:
      return [StreamLanguage.define(java)];
    default:
      return [];
  }
};

type BooleanCodeMirrorOption =
  | 'lineNumbers'
  | 'lineWrapping'
  | 'styleActiveLine'
  | 'matchBrackets'
  | 'autoCloseBrackets'
  | 'foldGutter'
  | 'readOnly';

/**
 * CodeMirror 5 boolean option -> the CodeMirror 6 extensions that replace it.
 *
 * `readOnly` also drops the caret and takes the editor out of the tab order
 * (`editable: false`), matching how CodeMirror 5 rendered a read-only view.
 */
const BOOLEAN_OPTION_EXTENSIONS: Array<
  [BooleanCodeMirrorOption, () => Extension[]]
> = [
  ['lineNumbers', () => [lineNumbers()]],
  ['lineWrapping', () => [EditorView.lineWrapping]],
  [
    'styleActiveLine',
    () => [highlightActiveLine(), highlightActiveLineGutter()],
  ],
  ['matchBrackets', () => [bracketMatching()]],
  ['autoCloseBrackets', () => [closeBrackets()]],
  ['foldGutter', () => [foldGutter()]],
  [
    'readOnly',
    () => [EditorState.readOnly.of(true), EditorView.editable.of(false)],
  ],
];

/**
 * Translate the CodeMirror 5 option bag call sites already pass into the
 * equivalent CodeMirror 6 extensions.
 *
 * Only options actually used in the codebase are mapped; anything else is
 * ignored rather than throwing, so an option added by a future call site
 * degrades to "no effect" instead of a runtime error.
 */
export const getCodeMirrorExtensions = (
  options: CodeMirrorOptions = {}
): Extension[] => {
  const extensions = BOOLEAN_OPTION_EXTENSIONS.filter(
    ([option]) => options[option]
  ).flatMap(([, buildExtensions]) => buildExtensions());

  if (options.placeholder) {
    extensions.push(placeholderExtension(options.placeholder));
  }

  if (!isUndefined(options.tabSize)) {
    extensions.push(EditorState.tabSize.of(options.tabSize));
  }

  if (!isUndefined(options.indentUnit)) {
    extensions.push(
      indentUnit.of(
        options.indentWithTabs ? '\t' : ' '.repeat(options.indentUnit)
      )
    );
  }

  return extensions;
};
