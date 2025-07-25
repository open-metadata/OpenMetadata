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

import { HTMLAttributes } from 'react';

export type TextVariant = 'white' | 'black';

export interface PreviewerProp {
  markdown: string;
  maxLength?: number;
  className?: string;
  enableSeeMoreVariant?: boolean;
  showReadMoreBtn?: boolean;
  isDescriptionExpanded?: boolean;
  textVariant?: TextVariant;
  reducePreviewLineClass?: string;
  showTooltipOnTruncate?: boolean;
}

export type PreviewStyle = 'tab' | 'vertical';

export type EditorType = 'markdown' | 'wysiwyg';

export interface RichTextEditorProp extends HTMLAttributes<HTMLDivElement> {
  autofocus?: boolean;
  initialValue?: string;
  readonly?: boolean;
  onTextChange?: (value: string) => void;
  placeHolder?: string;
}

export interface EditorContentRef {
  getEditorContent: () => string;
  clearEditorContent: () => void;
  setEditorContent: (content: string) => void;
}
