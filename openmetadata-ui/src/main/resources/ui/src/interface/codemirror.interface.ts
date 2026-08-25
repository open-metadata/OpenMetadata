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

/**
 * The editor option bag accepted by SchemaEditor/CodeEditor.
 *
 * These keys are the CodeMirror 5 option names that call sites already pass;
 * they are kept as-is so the ~55 consumers need no change, and are translated
 * to CodeMirror 6 extensions by `getCodeMirrorExtensions`.
 *
 * Keys that have no CodeMirror 6 equivalent (`gutters`, `theme`) are accepted
 * and ignored — gutters are implied by the extensions that render them, and
 * theming is done with `EditorView.theme`.
 */
export interface CodeMirrorOptions {
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  styleActiveLine?: boolean;
  matchBrackets?: boolean;
  autoCloseBrackets?: boolean;
  foldGutter?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  tabSize?: number;
  indentUnit?: number;
  indentWithTabs?: boolean;
  /** CodeMirror 5 only, ignored. */
  gutters?: string[];
  /** CodeMirror 5 only, ignored. */
  theme?: string;
}
