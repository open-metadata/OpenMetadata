/*
 *  Copyright 2024 Collate.
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

import { Extension } from '@codemirror/state';
import { ReactNode } from 'react';
import {
    CodeMirrorOptions,
    Mode
} from '../../../interface/codemirror.interface';

export type { Mode };

export interface SchemaEditorProps {
  value?: string;
  autoFormat?: boolean;
  /**
   * @deprecated No longer needed and ignored. It existed to stop the caret
   * jumping when a reformatted value was pushed back into CodeMirror 5 on every
   * keystroke; the editor never reformats the buffer mid-edit any more, so both
   * modes now behave the way this flag asked for.
   */
  uncontrolled?: boolean;
  /**
   * @deprecated No longer needed and ignored. CodeMirror 6 measures itself when
   * its container becomes visible or changes size.
   */
  refreshEditor?: boolean;
  className?: string;
  mode?: Mode;
  readOnly?: boolean;
  options?: CodeMirrorOptions;
  /**
   * Extra CodeMirror extensions (completion sources, update listeners, …).
   * Memoize this at the call site — a new array on every render reconfigures
   * the editor.
   */
  extensions?: Extension[];
  editorClass?: string;
  showCopyButton?: boolean;
  copyButtonClassName?: string;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  title?: ReactNode;
}
