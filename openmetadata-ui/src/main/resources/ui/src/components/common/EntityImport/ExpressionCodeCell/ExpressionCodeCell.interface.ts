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
import { CSMode } from '../../../../enums/codemirror.enum';
import { Language } from '../../../../generated/entity/data/metric';

export interface ExpressionCodeCellProps {
  value: string;
  language: Language;
  onCommit: (code: string, language: Language) => void;
  onCancel: () => void;
}

// A metric expression is one logical field (language + code). The editor's
// language tabs pick the language; CodeMirror highlights with the mapped mode.
export const LANGUAGE_TO_CODEMIRROR_MODE: Record<Language, CSMode> = {
  [Language.SQL]: CSMode.SQL,
  [Language.Python]: CSMode.PYTHON,
  [Language.JavaScript]: CSMode.JAVASCRIPT,
  [Language.Java]: CSMode.CLIKE,
  // CodeMirror has no External grammar. Fall back to SQL highlighting.
  [Language.External]: CSMode.SQL,
};
