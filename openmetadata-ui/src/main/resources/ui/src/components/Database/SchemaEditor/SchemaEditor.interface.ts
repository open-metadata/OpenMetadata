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

import { ReactNode } from 'react';
import { CSMode } from '../../../enums/codemirror.enum';

export type Mode = {
  name: CSMode;
  json?: boolean;
};

export interface SchemaEditorProps {
  value?: string;
  refreshEditor?: boolean;
  className?: string;
  mode?: Mode;
  readOnly?: boolean;
  options?: {
    [key: string]: string | boolean | Array<string>;
  };
  editorClass?: string;
  showCopyButton?: boolean;
  onChange?: (value: string) => void;
  onFocus?: () => void;
  title?: ReactNode;
}
