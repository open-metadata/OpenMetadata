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

import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';
import { LanguageSupport } from '@codemirror/language';

export enum CSMode {
  JAVASCRIPT = 'javascript',
  SQL = 'sql',
  PYTHON = 'python',
  CLIKE = 'clike',
  YAML = 'yaml',
}

export interface CSModeConfig {
  name: CSMode;
  json?: boolean;
}

export const getLanguageExtension = (mode: CSModeConfig): LanguageSupport => {
  switch (mode.name) {
    case CSMode.JAVASCRIPT:
      return javascript({ jsx: false, typescript: false });
    case CSMode.SQL:
      return sql();
    case CSMode.PYTHON:
      return python();
    case CSMode.CLIKE:
      return java();
    case CSMode.YAML:
      return yaml();
    default:
      return javascript({ jsx: false, typescript: false });
  }
};

export const getLanguageExtensionByName = (
  langName: string
): LanguageSupport | null => {
  switch (langName) {
    case 'javascript':
    case 'js':
      return javascript();
    case 'python':
    case 'py':
      return python();
    case 'sql':
      return sql();
    case 'yaml':
      return yaml();
    case 'java':
      return java();
    case 'c':
    case 'cpp':
    case 'c++':
    case 'csharp':
    case 'scala':
    case 'kotlin':
    case 'objectivec':
    case 'objectivec++':
      return cpp();
    default:
      return null;
  }
};
