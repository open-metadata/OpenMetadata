/*
 *  Copyright 2023 Collate.
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
import { Editor } from '@tiptap/react';
import { SuggestionKeyDownProps } from '@tiptap/suggestion';
import { EntityType } from '../../enums/entity.enum';

export type MenuType = 'bubble' | 'bar';

export interface SuggestionItem {
  id: string;
  name: string;
  fqn: string;
  label: string;
  type: string;
  href: string;
}

export interface ExtensionRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export interface EditorSlotsRef {
  onMouseDown: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onLinkToggle: () => void;
}

export interface BlockEditorRef {
  editor: Editor | null;
}
export interface BlockEditorProps {
  content?: string;
  editable?: boolean;
  onChange?: (htmlContent: string) => void;
  menuType?: MenuType;
  autoFocus?: boolean;
  placeholder?: string;
  showInlineAlert?: boolean;
}

export interface BlockEditorAttachmentProps {
  allowImageUpload?: boolean;
  onImageUpload?: (
    file: File,
    entityType?: EntityType,
    entityFqn?: string
  ) => Promise<string>;
}

export interface EditorSlotsProps {
  editor: Editor | null;
  menuType: MenuType;
}

export interface BarMenuProps {
  editor: Editor;
  onLinkToggle?: () => void;
}

export enum FileType {
  TEXT_HTML = 'text/html',
  FILE = 'file',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
}
