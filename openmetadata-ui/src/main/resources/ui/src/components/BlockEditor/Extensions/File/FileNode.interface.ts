/*
 *  Copyright 2025 Collate.
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
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { HTMLAttributes } from 'react';
import { FileType } from '../../BlockEditor.interface';

export interface FileNodeAttrs {
  url: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string;
  type: FileType;
  isUploading?: boolean;
  uploadProgress?: number;
  tempFile?: File;
  isImage?: boolean;
  alt?: string;
}

export interface FileNodeOptions {
  HTMLAttributes: Partial<HTMLAttributes<HTMLElement>>;
  allowedTypes?: FileType[];
}

export interface FileNodeStorage {
  renderFileContent: (node: ProseMirrorNode) => HTMLElement;
}
